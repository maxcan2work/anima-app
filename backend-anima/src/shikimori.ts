import { AuthProvider, WatchStatus } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { importShikimoriAnime } from './catalogProviders.js';
import { prisma } from './db.js';

type ShikimoriState = {
  sub: string;
  kind: 'shikimori_oauth';
};

type ShikimoriTokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
};

type ShikimoriProfileResponse = {
  id: number;
  nickname: string;
  avatar?: string | null;
  image?: {
    x160?: string | null;
    x80?: string | null;
    x48?: string | null;
  } | null;
};

type ShikimoriUserRate = {
  id: number;
  target_id: number;
  target_type: string;
  status: 'planned' | 'watching' | 'rewatching' | 'completed' | 'on_hold' | 'dropped';
  score?: number | null;
  episodes?: number | null;
  text?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  target?: {
    id: number;
  } | null;
};

type LinkedShikimoriAccount = {
  id: string;
  providerUserId: string;
  accessToken: string | null;
};

export function getShikimoriAuthUrl(userId: string) {
  assertShikimoriConfigured();

  const state = jwt.sign({ sub: userId, kind: 'shikimori_oauth' } satisfies ShikimoriState, config.JWT_SECRET, {
    expiresIn: '10m',
  });
  const params = new URLSearchParams({
    client_id: config.SHIKIMORI_CLIENT_ID!,
    redirect_uri: config.SHIKIMORI_REDIRECT_URI,
    response_type: 'code',
    scope: 'user_rates',
    state,
  });

  return `${config.SHIKIMORI_BASE_URL}/oauth/authorize?${params.toString()}`;
}

export async function exchangeShikimoriCode(code: string, state: string, userId: string) {
  assertShikimoriConfigured();
  assertShikimoriState(state, userId);

  const tokenResponse = await fetch(`${config.SHIKIMORI_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Anima',
    },
    body: new URLSearchParams({
      client_id: config.SHIKIMORI_CLIENT_ID!,
      client_secret: config.SHIKIMORI_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.SHIKIMORI_REDIRECT_URI,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Shikimori token request failed: ${tokenResponse.status}`);
  }

  const token = (await tokenResponse.json()) as ShikimoriTokenResponse;
  const profile = await fetchShikimoriProfile(token.access_token);
  const providerUserId = profile.nickname;
  const account = await prisma.authAccount.findUnique({
    where: {
      provider_providerUserId: {
        provider: AuthProvider.SHIKIMORI,
        providerUserId,
      },
    },
  });
  const existingUserAccount = await prisma.authAccount.findFirst({
    where: {
      userId,
      provider: AuthProvider.SHIKIMORI,
    },
  });

  if (account && account.userId !== userId) {
    throw new Error('This Shikimori account is already connected to another Anima user');
  }

  const targetAccount = account ?? existingUserAccount;

  if (targetAccount) {
    await prisma.authAccount.update({
      where: { id: targetAccount.id },
      data: {
        providerUserId,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
      },
    });
  } else {
    await prisma.authAccount.create({
      data: {
        userId,
        provider: AuthProvider.SHIKIMORI,
        providerUserId: profile.nickname,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
      },
    });
  }

  return {
    id: profile.nickname,
    nickname: profile.nickname,
  };
}

export async function getLinkedShikimoriProfile(account: LinkedShikimoriAccount) {
  let nickname = account.providerUserId;
  let avatarUrl: string | null = null;

  if (account.accessToken) {
    const profile = await fetchShikimoriProfile(account.accessToken);
    avatarUrl = getShikimoriAvatarUrl(profile);

    if (/^\d+$/.test(nickname) || nickname !== profile.nickname) {
      nickname = profile.nickname;

      await prisma.authAccount.update({
        where: { id: account.id },
        data: { providerUserId: nickname },
      });
    }
  }

  return {
    id: nickname,
    nickname,
    avatarUrl,
    profileUrl: getShikimoriProfileUrl(nickname),
  };
}

export async function importLinkedShikimoriAnimeList(userId: string) {
  const account = await prisma.authAccount.findFirst({
    where: {
      userId,
      provider: AuthProvider.SHIKIMORI,
    },
  });

  if (!account?.accessToken) {
    throw new Error('Shikimori account is not connected');
  }

  const profile = await fetchShikimoriProfile(account.accessToken);
  const rates = await fetchShikimoriAnimeRates(account.accessToken, profile.id);
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const rate of rates) {
    const shikimoriId = rate.target?.id ?? rate.target_id;
    if (!shikimoriId || rate.target_type !== 'Anime') {
      skipped += 1;
      continue;
    }

    try {
      const anime = await importShikimoriAnime(shikimoriId);
      const existing = await prisma.userAnime.findUnique({
        where: {
          userId_animeId: {
            userId,
            animeId: anime.id,
          },
        },
      });
      const data = {
        status: mapShikimoriWatchStatus(rate.status),
        currentEpisode: Math.max(Math.trunc(rate.episodes ?? 1), 1),
        score: rate.score && rate.score > 0 ? Math.trunc(rate.score) : null,
        review: rate.text?.trim() || null,
      };

      await prisma.userAnime.upsert({
        where: {
          userId_animeId: {
            userId,
            animeId: anime.id,
          },
        },
        update: data,
        create: {
          userId,
          animeId: anime.id,
          ...data,
        },
      });

      if (existing) {
        updated += 1;
      } else {
        imported += 1;
      }
    } catch {
      skipped += 1;
    }
  }

  return {
    imported,
    updated,
    skipped,
    total: rates.length,
  };
}

function getShikimoriProfileUrl(nickname: string) {
  return `${config.SHIKIMORI_BASE_URL}/${encodeURIComponent(nickname)}`;
}

function getShikimoriAvatarUrl(profile: ShikimoriProfileResponse) {
  const avatar = profile.image?.x160 ?? profile.image?.x80 ?? profile.image?.x48 ?? profile.avatar ?? null;

  if (!avatar) return null;
  return avatar.startsWith('http') ? avatar : `${config.SHIKIMORI_BASE_URL}${avatar}`;
}

async function fetchShikimoriProfile(accessToken: string) {
  const profileResponse = await fetch(`${config.SHIKIMORI_BASE_URL}/api/users/whoami`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'Anima',
    },
  });

  if (!profileResponse.ok) {
    throw new Error(`Shikimori profile request failed: ${profileResponse.status}`);
  }

  return (await profileResponse.json()) as ShikimoriProfileResponse;
}

async function fetchShikimoriAnimeRates(accessToken: string, userId: number) {
  const rates: ShikimoriUserRate[] = [];
  const limit = 100;

  for (let page = 1; page <= 50; page += 1) {
    const url = new URL(`/api/users/${userId}/anime_rates`, config.SHIKIMORI_BASE_URL);
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', String(limit));

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'Anima',
      },
    });

    if (!response.ok) {
      throw new Error(`Shikimori user rates request failed: ${response.status}`);
    }

    const pageRates = (await response.json()) as ShikimoriUserRate[];
    rates.push(...pageRates);

    if (pageRates.length < limit) {
      break;
    }
  }

  return rates;
}

function mapShikimoriWatchStatus(status: ShikimoriUserRate['status']) {
  switch (status) {
    case 'watching':
    case 'rewatching':
      return WatchStatus.WATCHING;
    case 'completed':
      return WatchStatus.COMPLETED;
    case 'dropped':
      return WatchStatus.DROPPED;
    case 'planned':
    case 'on_hold':
    default:
      return WatchStatus.PLANNED;
  }
}

function assertShikimoriState(state: string, userId: string) {
  const payload = jwt.verify(state, config.JWT_SECRET) as ShikimoriState;

  if (payload.kind !== 'shikimori_oauth' || payload.sub !== userId) {
    throw new Error('Invalid Shikimori OAuth state');
  }
}

function assertShikimoriConfigured() {
  if (!config.SHIKIMORI_CLIENT_ID || !config.SHIKIMORI_CLIENT_SECRET || !config.SHIKIMORI_REDIRECT_URI) {
    throw new Error('Shikimori OAuth is not configured');
  }
}
