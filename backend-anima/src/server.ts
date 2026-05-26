import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { AuthProvider, WatchStatus } from '@prisma/client';
import { clearSessionCookie, optionalAuth, requireAuth, setSessionCookie, signSession } from './auth.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { exchangeDiscordCode, getDiscordAuthUrl } from './discord.js';
import { browseCatalog, browsePlayableCatalog, importShikimoriAnime, searchCatalog, searchPlayableCatalog } from './catalogProviders.js';
import { findPlayerProviders } from './playerProviders.js';
import { exchangeShikimoriCode, getLinkedShikimoriProfile, getShikimoriAuthUrl, importLinkedShikimoriAnimeList } from './shikimori.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.WEB_ORIGIN,
    credentials: true,
  },
});

type WatchPartyParticipant = {
  id: string;
  name: string;
  avatarUrl: string | null;
  isHost: boolean;
};

type WatchPartyRoom = {
  code: string;
  hostSocketId: string;
  participants: Map<string, WatchPartyParticipant>;
  selectedAnime: WatchPartyAnime | null;
  episode: number;
  playback: WatchPartyPlaybackState;
};

type WatchPartyPlaybackState = {
  status: 'paused' | 'playing';
  position: number;
  updatedAt: number;
};

type WatchPartyAnime = {
  id: string;
  title: string;
  originalTitle: string | null;
  titleRu: string | null;
  titleEn: string | null;
  titleJa: string | null;
  titleRomaji: string | null;
  episodes: number;
  posterUrl: string | null;
  shikimoriId: number | null;
  malId: number | null;
  kind: string | null;
  genres: string | null;
  score: string | null;
  status: string | null;
  sourceUrl: string | null;
  airedOn: string | null;
};

const watchPartyRooms = new Map<string, WatchPartyRoom>();
const WATCH_PARTY_MAX_PARTICIPANTS = 16;

app.use(
  cors({
    origin: config.WEB_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(optionalAuth);

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

app.get('/watch-party/:code', (request, response) => {
  const code = normalizeWatchPartyCode(request.params.code);
  response.json({ exists: code ? watchPartyRooms.has(code) : false });
});

app.get('/auth/discord', (_request, response, next) => {
  try {
    response.redirect(getDiscordAuthUrl());
  } catch (error) {
    next(error);
  }
});

app.get('/auth/discord/callback', async (request, response, next) => {
  try {
    const code = String(request.query.code ?? '');
    if (!code) {
      response.status(400).json({ error: 'Discord authorization code is missing' });
      return;
    }

    const userId = await exchangeDiscordCode(code);
    setSessionCookie(response, signSession(userId));
    response.redirect(config.WEB_ORIGIN);
  } catch (error) {
    next(error);
  }
});

app.get('/auth/shikimori', requireAuth, (request, response, next) => {
  try {
    response.redirect(getShikimoriAuthUrl(request.userId!));
  } catch (error) {
    next(error);
  }
});

app.get('/auth/shikimori/callback', requireAuth, async (request, response, next) => {
  try {
    const code = String(request.query.code ?? '');
    const state = String(request.query.state ?? '');
    if (!code || !state) {
      response.status(400).json({ error: 'Shikimori authorization code or state is missing' });
      return;
    }

    await exchangeShikimoriCode(code, state, request.userId!);
    response.redirect(`${config.WEB_ORIGIN}/settings`);
  } catch (error) {
    next(error);
  }
});

app.post('/logout', (_request, response) => {
  clearSessionCookie(response);
  response.status(204).send();
});

app.get('/me', requireAuth, async (request, response, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
        accounts: {
          where: { provider: AuthProvider.SHIKIMORI },
          select: {
            id: true,
            providerUserId: true,
            accessToken: true,
            refreshToken: true,
            updatedAt: true,
          },
          take: 1,
        },
      },
    });
    const shikimoriProfile = user?.accounts[0] ? await getLinkedShikimoriProfile(user.accounts[0]) : null;

    response.json({
      user: user
        ? {
            id: user.id,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            createdAt: user.createdAt,
            integrations: {
              shikimori: shikimoriProfile
                ? {
                    id: shikimoriProfile.id,
                    nickname: shikimoriProfile.nickname,
                    avatarUrl: shikimoriProfile.avatarUrl,
                    profileUrl: shikimoriProfile.profileUrl,
                    connectedAt: user.accounts[0].updatedAt,
                  }
                : null,
            },
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
});

app.delete('/me/integrations/shikimori', requireAuth, async (request, response) => {
  await prisma.authAccount.deleteMany({
    where: {
      userId: request.userId!,
      provider: AuthProvider.SHIKIMORI,
    },
  });

  response.status(204).send();
});

app.post('/me/integrations/shikimori/import', requireAuth, async (request, response, next) => {
  try {
    const result = await importLinkedShikimoriAnimeList(request.userId!);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/anime', async (_request, response) => {
  const anime = await prisma.anime.findMany({
    orderBy: { title: 'asc' },
  });

  response.json({ anime });
});

app.get('/anime/:animeId', async (request, response) => {
  let anime = await prisma.anime.findUnique({
    where: { id: String(request.params.animeId) },
  });

  if (!anime) {
    response.status(404).json({ error: 'Anime not found' });
    return;
  }

  if (!anime.genres && anime.shikimoriId) {
    anime = await importShikimoriAnime(anime.shikimoriId);
  }

  response.json({ anime });
});

app.get('/catalog/search', async (request, response, next) => {
  try {
    const query = String(request.query.q ?? '');
    const playableProvider = String(request.query.playableProvider ?? '');
    const results = playableProvider ? await searchPlayableCatalog(query, playableProvider) : await searchCatalog(query);
    response.json({ results });
  } catch (error) {
    next(error);
  }
});

app.get('/catalog/browse', async (request, response, next) => {
  try {
    const page = Number(request.query.page ?? 1);
    const limit = Number(request.query.limit ?? 18);
    const order = String(request.query.order ?? 'popularity');
    const playableProvider = String(request.query.playableProvider ?? '');
    const result = playableProvider
      ? await browsePlayableCatalog(page, limit, order, playableProvider)
      : await browseCatalog(page, limit, order);

    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/catalog/import', async (request, response, next) => {
  try {
    const provider = String(request.body.provider ?? '');
    const providerId = Number(request.body.providerId);

    if (provider !== 'shikimori' || !Number.isFinite(providerId)) {
      response.status(400).json({ error: 'Invalid catalog provider' });
      return;
    }

    const anime = await importShikimoriAnime(Math.trunc(providerId));
    response.status(201).json({ anime });
  } catch (error) {
    next(error);
  }
});

app.get('/anime/:animeId/episodes/:episodeNumber/players', async (request, response) => {
  const animeId = String(request.params.animeId);
  const episodeNumber = Number(request.params.episodeNumber);

  if (!Number.isFinite(episodeNumber) || episodeNumber < 1) {
    response.status(400).json({ error: 'Invalid episode number' });
    return;
  }

  const result = await findPlayerProviders(animeId, Math.trunc(episodeNumber));
  if (!result) {
    response.status(404).json({ error: 'Anime not found' });
    return;
  }

  response.json(result);
});

app.get('/me/anime', requireAuth, async (request, response) => {
  const list = await prisma.userAnime.findMany({
    where: { userId: request.userId },
    include: { anime: true },
    orderBy: { updatedAt: 'desc' },
  });

  response.json({ list });
});

app.put('/me/anime/:animeId', requireAuth, async (request, response) => {
  const animeId = String(request.params.animeId);
  const anime = await prisma.anime.findUnique({ where: { id: animeId } });
  if (!anime) {
    response.status(404).json({ error: 'Anime not found' });
    return;
  }

  const status = parseWatchStatus(request.body.status);
  const currentEpisode = clampEpisode(Number(request.body.currentEpisode ?? 1), anime.episodes);
  const score = request.body.score == null ? null : clampScore(Number(request.body.score));
  const rewatchesProvided = Object.prototype.hasOwnProperty.call(request.body ?? {}, 'rewatches');
  const rewatches = rewatchesProvided ? clampRewatches(Number(request.body.rewatches)) : undefined;
  const startedAt = parseNullableDate(request.body.startedAt);
  const completedAt = parseNullableDate(request.body.completedAt);
  const review = parseNullableText(request.body.review);
  const updateData = {
    status,
    currentEpisode,
    score,
    startedAt,
    completedAt,
    review,
    ...(rewatches !== undefined ? { rewatches } : {}),
  };

  const entry = await prisma.userAnime.upsert({
    where: {
      userId_animeId: {
        userId: request.userId!,
        animeId: anime.id,
      },
    },
    create: {
      userId: request.userId!,
      animeId: anime.id,
      status,
      currentEpisode,
      score,
      rewatches: rewatches ?? 0,
      startedAt,
      completedAt,
      review,
    },
    update: updateData,
    include: { anime: true },
  });

  response.json({ entry });
});

app.get('/me/random-history', requireAuth, async (request, response) => {
  const history = await prisma.userRandomAnime.findMany({
    where: { userId: request.userId },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  response.json({ history });
});

app.delete('/me/random-history', requireAuth, async (request, response) => {
  await prisma.userRandomAnime.deleteMany({
    where: { userId: request.userId },
  });

  response.status(204).end();
});

app.delete('/me/random-history/:provider/:providerId', requireAuth, async (request, response) => {
  const provider = String(request.params.provider ?? '');
  const providerId = Number(request.params.providerId);

  if (provider !== 'shikimori' || !Number.isFinite(providerId)) {
    response.status(400).json({ error: 'Invalid random anime provider' });
    return;
  }

  await prisma.userRandomAnime.deleteMany({
    where: {
      userId: request.userId,
      provider,
      providerId: Math.trunc(providerId),
    },
  });

  response.status(204).end();
});

app.post('/me/random-history', requireAuth, async (request, response) => {
  const provider = String(request.body.provider ?? '');
  const providerId = Number(request.body.providerId);

  if (provider !== 'shikimori' || !Number.isFinite(providerId)) {
    response.status(400).json({ error: 'Invalid random anime provider' });
    return;
  }

  const entry = await prisma.userRandomAnime.upsert({
    where: {
      userId_provider_providerId: {
        userId: request.userId!,
        provider,
        providerId: Math.trunc(providerId),
      },
    },
    create: {
      userId: request.userId!,
      provider,
      providerId: Math.trunc(providerId),
      title: parseRequiredText(request.body.title, 'title'),
      originalTitle: parseRequiredText(request.body.originalTitle, 'originalTitle'),
      titleRu: parseNullableText(request.body.titleRu),
      titleEn: parseNullableText(request.body.titleEn),
      titleJa: parseNullableText(request.body.titleJa),
      titleRomaji: parseNullableText(request.body.titleRomaji),
      episodes: Math.max(Math.trunc(Number(request.body.episodes) || 1), 1),
      posterUrl: parseNullableText(request.body.posterUrl),
      kind: parseNullableText(request.body.kind),
      score: parseNullableText(request.body.score),
      status: parseNullableText(request.body.status),
      malId: parseNullableInt(request.body.malId),
      sourceUrl: parseRequiredText(request.body.sourceUrl, 'sourceUrl'),
    },
    update: {
      title: parseRequiredText(request.body.title, 'title'),
      originalTitle: parseRequiredText(request.body.originalTitle, 'originalTitle'),
      titleRu: parseNullableText(request.body.titleRu),
      titleEn: parseNullableText(request.body.titleEn),
      titleJa: parseNullableText(request.body.titleJa),
      titleRomaji: parseNullableText(request.body.titleRomaji),
      episodes: Math.max(Math.trunc(Number(request.body.episodes) || 1), 1),
      posterUrl: parseNullableText(request.body.posterUrl),
      kind: parseNullableText(request.body.kind),
      score: parseNullableText(request.body.score),
      status: parseNullableText(request.body.status),
      malId: parseNullableInt(request.body.malId),
      sourceUrl: parseRequiredText(request.body.sourceUrl, 'sourceUrl'),
    },
  });

  const staleEntries = await prisma.userRandomAnime.findMany({
    where: { userId: request.userId },
    orderBy: { updatedAt: 'desc' },
    skip: 10,
    select: { id: true },
  });

  if (staleEntries.length > 0) {
    await prisma.userRandomAnime.deleteMany({
      where: { id: { in: staleEntries.map((item) => item.id) } },
    });
  }

  response.status(201).json({ entry });
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : 'Internal server error';
  const status = message.includes('not configured') ? 503 : 500;
  response.status(status).json({ error: message });
});

io.on('connection', (socket) => {
  socket.on('watch-party:join', (payload: unknown) => {
    const code = normalizeWatchPartyCode(getPayloadString(payload, 'code'));
    if (!code) return;

    const shouldCreateRoom = getPayloadValue(payload, 'create') === true;
    const room = watchPartyRooms.get(code) ?? (shouldCreateRoom ? createWatchPartyRoom(code, socket.id) : null);
    if (!room) {
      socket.emit('watch-party:join-rejected', { reason: 'room-not-found' });
      return;
    }

    if (!room.participants.has(socket.id) && room.participants.size >= WATCH_PARTY_MAX_PARTICIPANTS) {
      socket.emit('watch-party:join-rejected', { reason: 'room-full' });
      return;
    }

    const participant: WatchPartyParticipant = {
      id: socket.id,
      name: getPayloadString(payload, 'name') || 'Гость',
      avatarUrl: getPayloadString(payload, 'avatarUrl') || null,
      isHost: room.hostSocketId === socket.id,
    };

    socket.join(watchPartyRoomName(code));
    room.participants.set(socket.id, participant);
    emitWatchPartyState(room);
  });

  socket.on('watch-party:select-anime', (payload: unknown) => {
    const code = normalizeWatchPartyCode(getPayloadString(payload, 'code'));
    const room = code ? watchPartyRooms.get(code) : null;
    if (!room || room.hostSocketId !== socket.id) return;

    const anime = getPayloadObject(payload, 'anime') as WatchPartyAnime | null;
    if (!anime || !anime.id || !anime.title) return;

    room.selectedAnime = anime;
    room.episode = 1;
    room.playback = createInitialPlaybackState();
    emitWatchPartyState(room);
  });

  socket.on('watch-party:set-episode', (payload: unknown) => {
    const code = normalizeWatchPartyCode(getPayloadString(payload, 'code'));
    const room = code ? watchPartyRooms.get(code) : null;
    if (!room || room.hostSocketId !== socket.id || !room.selectedAnime) return;

    const episode = Number(getPayloadValue(payload, 'episode'));
    if (!Number.isFinite(episode)) return;

    room.episode = Math.min(Math.max(Math.trunc(episode), 1), room.selectedAnime.episodes || 1);
    room.playback = createInitialPlaybackState();
    emitWatchPartyState(room);
  });

  socket.on('watch-party:set-playback', (payload: unknown) => {
    const code = normalizeWatchPartyCode(getPayloadString(payload, 'code'));
    const room = code ? watchPartyRooms.get(code) : null;
    if (!room || room.hostSocketId !== socket.id || !room.selectedAnime) return;

    const status = getPayloadString(payload, 'status');
    const position = Number(getPayloadValue(payload, 'position'));
    if (status !== 'playing' && status !== 'paused') return;
    if (!Number.isFinite(position)) return;

    room.playback = {
      status,
      position: Math.max(0, position),
      updatedAt: Date.now(),
    };
    emitWatchPartyState(room);
  });

  socket.on('watch-party:kick', (payload: unknown) => {
    const code = normalizeWatchPartyCode(getPayloadString(payload, 'code'));
    const participantId = getPayloadString(payload, 'participantId');
    const room = code ? watchPartyRooms.get(code) : null;
    if (!room || room.hostSocketId !== socket.id || participantId === room.hostSocketId) return;

    const target = io.sockets.sockets.get(participantId);
    target?.emit('watch-party:kicked');
    target?.disconnect(true);
  });

  socket.on('disconnect', () => {
    for (const room of watchPartyRooms.values()) {
      if (!room.participants.has(socket.id)) continue;

      room.participants.delete(socket.id);
      if (room.participants.size === 0) {
        watchPartyRooms.delete(room.code);
        continue;
      }

      if (room.hostSocketId === socket.id) {
        const nextHost = room.participants.values().next().value as WatchPartyParticipant | undefined;
        if (nextHost) {
          room.hostSocketId = nextHost.id;
          nextHost.isHost = true;
          room.participants.set(nextHost.id, nextHost);
        }
      }

      emitWatchPartyState(room);
    }
  });
});

server.listen(config.PORT, () => {
  console.log(`Backend Anima API: http://localhost:${config.PORT}`);
});

function createWatchPartyRoom(code: string, socketId: string) {
  const room: WatchPartyRoom = {
    code,
    hostSocketId: socketId,
    participants: new Map(),
    selectedAnime: null,
    episode: 1,
    playback: createInitialPlaybackState(),
  };
  watchPartyRooms.set(code, room);
  return room;
}

function emitWatchPartyState(room: WatchPartyRoom) {
  const participants = Array.from(room.participants.values()).map((participant) => ({
    ...participant,
    isHost: participant.id === room.hostSocketId,
  }));

  io.to(watchPartyRoomName(room.code)).emit('watch-party:state', {
    code: room.code,
    participants,
    selectedAnime: room.selectedAnime,
    episode: room.episode,
    playback: room.playback,
  });
}

function createInitialPlaybackState(): WatchPartyPlaybackState {
  return {
    status: 'paused',
    position: 0,
    updatedAt: Date.now(),
  };
}

function watchPartyRoomName(code: string) {
  return `watch-party:${code}`;
}

function getPayloadString(payload: unknown, key: string) {
  const value = getPayloadValue(payload, key);
  return typeof value === 'string' ? value.trim() : '';
}

function getPayloadObject(payload: unknown, key: string) {
  const value = getPayloadValue(payload, key);
  return value && typeof value === 'object' ? value : null;
}

function getPayloadValue(payload: unknown, key: string) {
  if (!payload || typeof payload !== 'object' || !(key in payload)) return '';
  return (payload as Record<string, unknown>)[key];
}

function normalizeWatchPartyCode(value: string) {
  return value.replace(/[^a-z0-9]/gi, '').slice(0, 12).toUpperCase();
}

function parseWatchStatus(value: unknown) {
  const status = String(value ?? WatchStatus.PLANNED).toUpperCase();
  if (status in WatchStatus) {
    return status as WatchStatus;
  }

  return WatchStatus.PLANNED;
}

function clampEpisode(value: number, max: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(Math.trunc(value), 1), max);
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return null;
  return Math.min(Math.max(Math.trunc(value), 1), 10);
}

function clampRewatches(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(Math.trunc(value), 0);
}

function parseNullableDate(value: unknown) {
  if (value == null || value === '') return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseNullableText(value: unknown) {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function parseNullableInt(value: unknown) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function parseRequiredText(value: unknown, field: string) {
  const text = parseNullableText(value);
  if (!text) {
    throw new Error(`${field} is required`);
  }

  return text;
}
