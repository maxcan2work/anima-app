import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { WatchStatus } from '@prisma/client';
import { clearSessionCookie, optionalAuth, requireAuth, setSessionCookie, signSession } from './auth.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { exchangeDiscordCode, getDiscordAuthUrl } from './discord.js';
import { browseCatalog, importShikimoriAnime, searchCatalog } from './catalogProviders.js';
import { findPlayerProviders } from './playerProviders.js';

const app = express();

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

app.post('/logout', (_request, response) => {
  clearSessionCookie(response);
  response.status(204).send();
});

app.get('/me', requireAuth, async (request, response) => {
  const user = await prisma.user.findUnique({
    where: { id: request.userId },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  response.json({ user });
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
    const results = await searchCatalog(query);
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
    const result = await browseCatalog(page, limit, order);

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
  const startedAt = parseNullableDate(request.body.startedAt);
  const completedAt = parseNullableDate(request.body.completedAt);
  const review = parseNullableText(request.body.review);

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
      startedAt,
      completedAt,
      review,
    },
    update: {
      status,
      currentEpisode,
      score,
      startedAt,
      completedAt,
      review,
    },
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

app.listen(config.PORT, () => {
  console.log(`Backend Anima API: http://localhost:${config.PORT}`);
});

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
