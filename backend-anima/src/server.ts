import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { AuthProvider, WatchStatus } from '@prisma/client';
import { clearSessionCookie, optionalAuth, requireAuth, setSessionCookie, signSession } from './auth.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { exchangeDiscordCode, getDiscordAuthUrl } from './discord.js';
import {
  browseCatalog,
  browsePlayableCatalog,
  getCatalogAnimeDetails,
  getCatalogAnimeExtendedDetails,
  getCatalogGenres,
  importShikimoriAnime,
  searchCatalog,
  searchPlayableCatalog,
} from './catalogProviders.js';
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
  settings: WatchPartyRoomSettings;
  passwordHash: string | null;
  selectedAnime: WatchPartyAnime | null;
  episode: number;
  playback: WatchPartyPlaybackState;
};

type WatchPartyPermission = 'host' | 'everyone';

type WatchPartyRoomSettings = {
  name: string;
  maxParticipants: number;
  visibility: 'public' | 'code';
  passwordProtected: boolean;
  animeSelection: WatchPartyPermission;
  episodeControl: WatchPartyPermission;
  playbackControl: WatchPartyPermission;
  transferHost: boolean;
  autoPlay: boolean;
  allowJoinAfterStart: boolean;
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

app.get('/watch-party', (_request, response) => {
  const rooms = Array.from(watchPartyRooms.values())
    .filter((room) => (
      room.settings.visibility === 'public'
      && room.participants.size < room.settings.maxParticipants
      && (!room.selectedAnime || room.settings.allowJoinAfterStart)
    ))
    .map((room) => ({
      code: room.code,
      name: room.settings.name,
      participantCount: room.participants.size,
      maxParticipants: room.settings.maxParticipants,
      passwordProtected: Boolean(room.passwordHash),
      hasStarted: Boolean(room.selectedAnime),
    }));
  response.json({ rooms });
});

app.get('/watch-party/:code', (request, response) => {
  const code = normalizeWatchPartyCode(request.params.code);
  const room = code ? watchPartyRooms.get(code) : null;
  response.json({
    exists: Boolean(room),
    requiresPassword: Boolean(room?.passwordHash),
  });
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

  if ((!anime.genres || !anime.studio) && anime.shikimoriId) {
    anime = await importShikimoriAnime(anime.shikimoriId);
  }

  response.json({ anime });
});

app.get('/anime/:animeId/details', async (request, response, next) => {
  try {
    const anime = await prisma.anime.findUnique({
      where: { id: String(request.params.animeId) },
      select: { shikimoriId: true },
    });

    if (!anime) {
      response.status(404).json({ error: 'Anime not found' });
      return;
    }

    if (!anime.shikimoriId) {
      response.json({ details: { similar: [], characters: [], people: [], screenshots: [] } });
      return;
    }

    const details = await getCatalogAnimeExtendedDetails(anime.shikimoriId);
    response.json({ details });
  } catch (error) {
    next(error);
  }
});

app.get('/anime/:animeId/reviews', async (request, response, next) => {
  try {
    const animeId = String(request.params.animeId);
    const anime = await prisma.anime.findUnique({ where: { id: animeId }, select: { id: true } });
    if (!anime) {
      response.status(404).json({ error: 'Anime not found' });
      return;
    }

    const reviews = await prisma.animeReview.findMany({
      where: { animeId },
      include: reviewInclude(),
      orderBy: { createdAt: 'desc' },
    });

    response.json({ reviews: reviews.map(formatAnimeReview) });
  } catch (error) {
    next(error);
  }
});

app.get('/anime/:animeId/reviews/:reviewId', async (request, response, next) => {
  try {
    const animeId = String(request.params.animeId);
    const review = await prisma.animeReview.findFirst({
      where: {
        id: String(request.params.reviewId),
        animeId,
      },
      include: reviewInclude(),
    });

    if (!review) {
      response.status(404).json({ error: 'Review not found' });
      return;
    }

    response.json({ review: formatAnimeReview(review) });
  } catch (error) {
    next(error);
  }
});

app.post('/anime/:animeId/reviews', requireAuth, async (request, response, next) => {
  try {
    const animeId = String(request.params.animeId);
    const anime = await prisma.anime.findUnique({ where: { id: animeId }, select: { id: true } });
    if (!anime) {
      response.status(404).json({ error: 'Anime not found' });
      return;
    }

    const payload = parseReviewPayload(request.body);
    const review = await prisma.animeReview.upsert({
      where: {
        animeId_userId: {
          animeId,
          userId: request.userId!,
        },
      },
      create: {
        animeId,
        userId: request.userId!,
        ...payload,
      },
      update: payload,
      include: reviewInclude(),
    });

    response.status(201).json({ review: formatAnimeReview(review) });
  } catch (error) {
    next(error);
  }
});

app.get('/catalog/search', async (request, response, next) => {
  try {
    const query = String(request.query.q ?? '');
    const playableProvider = String(request.query.playableProvider ?? '');
    const filters = {
      kind: String(request.query.kind ?? ''),
      status: String(request.query.status ?? ''),
      scoredOnly: String(request.query.scoredOnly ?? '') === 'true',
      season: String(request.query.season ?? ''),
      genre: String(request.query.genre ?? ''),
      score: String(request.query.score ?? ''),
      rating: String(request.query.rating ?? ''),
    };
    const results = playableProvider ? await searchPlayableCatalog(query, playableProvider, filters) : await searchCatalog(query, filters);
    response.json({ results });
  } catch (error) {
    next(error);
  }
});

app.get('/catalog/genres', async (_request, response, next) => {
  try {
    const genres = await getCatalogGenres();
    response.json({ genres });
  } catch (error) {
    next(error);
  }
});

app.get('/catalog/:provider/:providerId', async (request, response, next) => {
  try {
    const provider = String(request.params.provider ?? '');
    const providerId = Number(request.params.providerId);

    if (provider !== 'shikimori' || !Number.isFinite(providerId)) {
      response.status(400).json({ error: 'Invalid catalog provider' });
      return;
    }

    const anime = await getCatalogAnimeDetails(Math.trunc(providerId));
    response.json({ anime });
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
    const filters = {
      kind: String(request.query.kind ?? ''),
      status: String(request.query.status ?? ''),
      scoredOnly: String(request.query.scoredOnly ?? '') === 'true',
      season: String(request.query.season ?? ''),
      genre: String(request.query.genre ?? ''),
      score: String(request.query.score ?? ''),
      rating: String(request.query.rating ?? ''),
    };
    const result = playableProvider
      ? await browsePlayableCatalog(page, limit, order, playableProvider, filters)
      : await browseCatalog(page, limit, order, filters);

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

app.delete('/me/anime/:animeId', requireAuth, async (request, response) => {
  await prisma.userAnime.deleteMany({
    where: {
      userId: request.userId!,
      animeId: String(request.params.animeId),
    },
  });

  response.status(204).send();
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

    if (!room.participants.has(socket.id) && room.participants.size >= room.settings.maxParticipants) {
      socket.emit('watch-party:join-rejected', { reason: 'room-full' });
      return;
    }

    if (!room.participants.has(socket.id) && room.passwordHash && !verifyWatchPartyPassword(getPayloadString(payload, 'password'), room.passwordHash)) {
      socket.emit('watch-party:join-rejected', { reason: 'invalid-password' });
      return;
    }

    if (!room.participants.has(socket.id) && room.selectedAnime && !room.settings.allowJoinAfterStart) {
      socket.emit('watch-party:join-rejected', { reason: 'room-started' });
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
    if (!room || !canUseWatchPartyPermission(room, socket.id, room.settings.animeSelection)) return;

    const anime = getPayloadObject(payload, 'anime') as WatchPartyAnime | null;
    if (!anime || !anime.id || !anime.title) return;

    room.selectedAnime = anime;
    room.episode = 1;
    room.playback = {
      ...createInitialPlaybackState(),
      status: room.settings.autoPlay ? 'playing' : 'paused',
    };
    emitWatchPartyState(room);
  });

  socket.on('watch-party:set-episode', (payload: unknown) => {
    const code = normalizeWatchPartyCode(getPayloadString(payload, 'code'));
    const room = code ? watchPartyRooms.get(code) : null;
    if (!room || !canUseWatchPartyPermission(room, socket.id, room.settings.episodeControl) || !room.selectedAnime) return;

    const episode = Number(getPayloadValue(payload, 'episode'));
    if (!Number.isFinite(episode)) return;

    room.episode = Math.min(Math.max(Math.trunc(episode), 1), room.selectedAnime.episodes || 1);
    room.playback = createInitialPlaybackState();
    emitWatchPartyState(room);
  });

  socket.on('watch-party:set-playback', (payload: unknown) => {
    const code = normalizeWatchPartyCode(getPayloadString(payload, 'code'));
    const room = code ? watchPartyRooms.get(code) : null;
    if (!room || !canUseWatchPartyPermission(room, socket.id, room.settings.playbackControl) || !room.selectedAnime) return;

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

  socket.on('watch-party:update-settings', (payload: unknown) => {
    const code = normalizeWatchPartyCode(getPayloadString(payload, 'code'));
    const room = code ? watchPartyRooms.get(code) : null;
    if (!room || room.hostSocketId !== socket.id) return;

    const settings = getPayloadObject(payload, 'settings');
    if (!settings) return;

    const requestedLimit = clampWatchPartyLimit(Number(getObjectValue(settings, 'maxParticipants')));
    if (requestedLimit < room.participants.size) {
      socket.emit('watch-party:settings-rejected', { reason: 'limit-below-participants' });
      return;
    }

    room.settings = {
      name: getObjectString(settings, 'name').slice(0, 48),
      maxParticipants: requestedLimit,
      visibility: getObjectString(settings, 'visibility') === 'public' ? 'public' : 'code',
      passwordProtected: room.settings.passwordProtected,
      animeSelection: parseWatchPartyPermission(getObjectValue(settings, 'animeSelection')),
      episodeControl: parseWatchPartyPermission(getObjectValue(settings, 'episodeControl')),
      playbackControl: parseWatchPartyPermission(getObjectValue(settings, 'playbackControl')),
      transferHost: getObjectBoolean(settings, 'transferHost'),
      autoPlay: getObjectBoolean(settings, 'autoPlay'),
      allowJoinAfterStart: getObjectBoolean(settings, 'allowJoinAfterStart'),
    };

    if ('password' in settings) {
      const password = getObjectString(settings, 'password');
      room.passwordHash = password ? hashWatchPartyPassword(password.slice(0, 128)) : null;
    }
    room.settings.passwordProtected = Boolean(room.passwordHash);
    emitWatchPartyState(room);
  });

  socket.on('watch-party:close', (payload: unknown) => {
    const code = normalizeWatchPartyCode(getPayloadString(payload, 'code'));
    const room = code ? watchPartyRooms.get(code) : null;
    if (!room || room.hostSocketId !== socket.id) return;
    closeWatchPartyRoom(room);
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
        if (!room.settings.transferHost) {
          closeWatchPartyRoom(room);
          continue;
        }

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
    settings: createDefaultWatchPartySettings(),
    passwordHash: null,
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
    settings: room.settings,
    selectedAnime: room.selectedAnime,
    episode: room.episode,
    playback: room.playback,
  });
}

function createDefaultWatchPartySettings(): WatchPartyRoomSettings {
  return {
    name: '',
    maxParticipants: WATCH_PARTY_MAX_PARTICIPANTS,
    visibility: 'code',
    passwordProtected: false,
    animeSelection: 'host',
    episodeControl: 'host',
    playbackControl: 'host',
    transferHost: true,
    autoPlay: false,
    allowJoinAfterStart: true,
  };
}

function closeWatchPartyRoom(room: WatchPartyRoom) {
  io.to(watchPartyRoomName(room.code)).emit('watch-party:room-closed');
  io.in(watchPartyRoomName(room.code)).socketsLeave(watchPartyRoomName(room.code));
  watchPartyRooms.delete(room.code);
}

function canUseWatchPartyPermission(room: WatchPartyRoom, socketId: string, permission: WatchPartyPermission) {
  return room.participants.has(socketId) && (permission === 'everyone' || room.hostSocketId === socketId);
}

function parseWatchPartyPermission(value: unknown): WatchPartyPermission {
  return value === 'everyone' ? 'everyone' : 'host';
}

function clampWatchPartyLimit(value: number) {
  if (!Number.isFinite(value)) return WATCH_PARTY_MAX_PARTICIPANTS;
  return Math.min(Math.max(Math.trunc(value), 2), WATCH_PARTY_MAX_PARTICIPANTS);
}

function hashWatchPartyPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyWatchPartyPassword(password: string, storedHash: string) {
  if (!password) return false;
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function getObjectString(value: object, key: string) {
  const item = getObjectValue(value, key);
  return typeof item === 'string' ? item.trim() : '';
}

function getObjectBoolean(value: object, key: string) {
  return getObjectValue(value, key) === true;
}

function getObjectValue(value: object, key: string) {
  return (value as Record<string, unknown>)[key];
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

function reviewInclude() {
  return {
    user: {
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        _count: {
          select: {
            animeList: true,
            reviews: true,
          },
        },
      },
    },
  } as const;
}

function formatAnimeReview(review: {
  id: string;
  animeId: string;
  userId: string;
  title: string;
  body: string;
  score: number;
  recommended: boolean;
  hasSpoilers: boolean;
  storyScore: number;
  charactersScore: number;
  visualsScore: number;
  musicScore: number;
  openingScore: number;
  atmosphereScore: number;
  likes: number;
  dislikes: number;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    _count: {
      animeList: number;
      reviews: number;
    };
  };
}) {
  return {
    id: review.id,
    animeId: review.animeId,
    userId: review.userId,
    author: review.user.displayName,
    avatarUrl: review.user.avatarUrl,
    avatarLabel: createAvatarLabel(review.user.displayName),
    watched: review.user._count.animeList,
    reviewsCount: review.user._count.reviews,
    helpfulCount: review.likes,
    likes: review.likes,
    dislikes: review.dislikes,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    recommended: review.recommended,
    hasSpoilers: review.hasSpoilers,
    score: review.score,
    scores: {
      story: review.storyScore,
      characters: review.charactersScore,
      visuals: review.visualsScore,
      music: review.musicScore,
      opening: review.openingScore,
      atmosphere: review.atmosphereScore,
    },
    title: review.title,
    excerpt: createReviewExcerpt(review.body),
    body: review.body,
  };
}

function parseReviewPayload(body: unknown) {
  const payload = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const scores = payload.scores && typeof payload.scores === 'object' ? payload.scores as Record<string, unknown> : {};

  return {
    title: parseRequiredText(payload.title, 'title').slice(0, 160),
    body: parseRequiredText(payload.body, 'body').slice(0, 12000),
    score: requireReviewScore(payload.score, 'score'),
    recommended: typeof payload.recommended === 'boolean' ? payload.recommended : true,
    hasSpoilers: typeof payload.hasSpoilers === 'boolean' ? payload.hasSpoilers : false,
    storyScore: requireReviewScore(scores.story, 'scores.story'),
    charactersScore: requireReviewScore(scores.characters, 'scores.characters'),
    visualsScore: requireReviewScore(scores.visuals, 'scores.visuals'),
    musicScore: requireReviewScore(scores.music, 'scores.music'),
    openingScore: requireReviewScore(scores.opening, 'scores.opening'),
    atmosphereScore: requireReviewScore(scores.atmosphere, 'scores.atmosphere'),
  };
}

function requireReviewScore(value: unknown, field: string) {
  const score = clampScore(Number(value));
  if (score == null) {
    throw new Error(`${field} must be a number from 1 to 10`);
  }

  return score;
}

function createReviewExcerpt(body: string) {
  const excerpt = body.replace(/\s+/g, ' ').trim();
  return excerpt.length > 180 ? `${excerpt.slice(0, 177)}...` : excerpt;
}

function createAvatarLabel(displayName: string) {
  return displayName.trim().slice(0, 1).toUpperCase() || '?';
}
