import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { WatchStatus } from '@prisma/client';
import { clearSessionCookie, optionalAuth, requireAuth, setSessionCookie, signSession } from './auth.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { exchangeDiscordCode, getDiscordAuthUrl } from './discord.js';

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
    },
    update: {
      status,
      currentEpisode,
      score,
    },
    include: { anime: true },
  });

  response.json({ entry });
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
