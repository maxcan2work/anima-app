import { fromShikimoriWatchStatus } from '@anima/core';
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
  target_id?: number;
  target_type?: string;
  status: 'planned' | 'watching' | 'rewatching' | 'completed' | 'on_hold' | 'dropped';
  score?: number | null;
  episodes?: number | null;
  rewatches?: number | null;
  text?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  target?: {
    id: number;
  } | null;
  anime?: {
    id: number;
  } | null;
};

type LinkedShikimoriAccount = {
  id: string;
  providerUserId: string;
  accessToken: string | null;
  refreshToken: string | null;
};

class ShikimoriRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

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
    const linkedProfile = await fetchLinkedShikimoriProfile(account).catch((error) => {
      console.warn('Failed to refresh linked Shikimori profile', error);
      return null;
    });

    if (linkedProfile) {
      const { profile } = linkedProfile;
      avatarUrl = getShikimoriAvatarUrl(profile);

      if (/^\d+$/.test(nickname) || nickname !== profile.nickname) {
        nickname = profile.nickname;

        await prisma.authAccount.update({
          where: { id: account.id },
          data: { providerUserId: nickname },
        });
      }
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

  const { accessToken, profile } = await fetchLinkedShikimoriProfile(account);
  const rates = await fetchShikimoriAnimeRates(accessToken, profile.id);
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ shikimoriId: number | null; reason: string }> = [];
  const seenAnimeIds = new Set<number>();

  for (const rate of rates) {
    const shikimoriId = Number(rate.target?.id ?? rate.anime?.id ?? rate.target_id);
    if (!Number.isFinite(shikimoriId) || shikimoriId <= 0 || (rate.target_type && rate.target_type !== 'Anime')) {
      skipped += 1;
      if (errors.length < 10) {
        errors.push({
          shikimoriId: Number.isFinite(shikimoriId) ? shikimoriId : null,
          reason: `Invalid anime rate payload: target_type=${rate.target_type ?? 'missing'}`,
        });
      }
      continue;
    }

    if (seenAnimeIds.has(shikimoriId)) {
      skipped += 1;
      continue;
    }
    seenAnimeIds.add(shikimoriId);

    try {
      const anime = await importShikimoriAnimeWithRetry(shikimoriId);
      const existing = await prisma.userAnime.findUnique({
        where: {
          userId_animeId: {
            userId,
            animeId: anime.id,
          },
        },
      });
      const data = {
        status: toPrismaWatchStatus(fromShikimoriWatchStatus(rate.status)),
        currentEpisode: Math.max(Math.trunc(rate.episodes ?? 1), 1),
        score: rate.score && rate.score > 0 ? Math.trunc(rate.score) : null,
        rewatches: Math.max(Math.trunc(rate.rewatches ?? 0), 0),
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
    } catch (error) {
      skipped += 1;
      if (errors.length < 10) {
        errors.push({
          shikimoriId,
          reason: error instanceof Error ? error.message : 'Anime import or diary update failed',
        });
      }
    }
  }

  return {
    imported,
    updated,
    skipped,
    total: rates.length,
    errors,
  };
}

async function importShikimoriAnimeWithRetry(shikimoriId: number) {
  const delays = [0, 1500, 3500, 7000];
  let lastError: unknown;

  for (const delay of delays) {
    if (delay > 0) {
      await sleep(delay);
    }

    try {
      return await importShikimoriAnime(shikimoriId);
    } catch (error) {
      lastError = error;
      if (!(error instanceof Error) || !error.message.includes('429')) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Shikimori import failed');
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
    throw new ShikimoriRequestError(`Shikimori profile request failed: ${profileResponse.status}`, profileResponse.status);
  }

  return (await profileResponse.json()) as ShikimoriProfileResponse;
}

async function fetchLinkedShikimoriProfile(account: LinkedShikimoriAccount) {
  if (!account.accessToken) {
    throw new Error('Shikimori account is not connected');
  }

  try {
    const profile = await fetchShikimoriProfile(account.accessToken);
    return { accessToken: account.accessToken, profile };
  } catch (error) {
    if (!(error instanceof ShikimoriRequestError) || error.status !== 401 || !account.refreshToken) {
      throw error;
    }

    const token = await refreshShikimoriToken(account.refreshToken);
    await prisma.authAccount.update({
      where: { id: account.id },
      data: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? account.refreshToken,
      },
    });

    const profile = await fetchShikimoriProfile(token.access_token);
    return { accessToken: token.access_token, profile };
  }
}

async function refreshShikimoriToken(refreshToken: string) {
  assertShikimoriConfigured();

  const tokenResponse = await fetch(`${config.SHIKIMORI_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Anima',
    },
    body: new URLSearchParams({
      client_id: config.SHIKIMORI_CLIENT_ID!,
      client_secret: config.SHIKIMORI_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!tokenResponse.ok) {
    throw new ShikimoriRequestError(`Shikimori token refresh failed: ${tokenResponse.status}`, tokenResponse.status);
  }

  return (await tokenResponse.json()) as ShikimoriTokenResponse;
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
      if (response.status === 404) {
        return fetchShikimoriAnimeRatesGraphql(accessToken, userId);
      }

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

async function fetchShikimoriAnimeRatesGraphql(accessToken: string, userId: number) {
  const rates: ShikimoriUserRate[] = [];
  const limit = 50;

  for (let page = 1; page <= 100; page += 1) {
    const response = await fetch(`${config.SHIKIMORI_BASE_URL}/api/graphql`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Anima',
      },
      body: JSON.stringify({
        query: `
          query {
            userRates(userId: ${userId}, targetType: Anime, page: ${page}, limit: ${limit}) {
              id
              status
              score
              episodes
              text
              target {
                ... on Anime {
                  id
                }
              }
              anime {
                id
              }
            }
          }
        `,
      }),
    });

    if (!response.ok) {
      throw new Error(`Shikimori user rates GraphQL request failed: ${response.status}`);
    }

    const payload = (await response.json()) as {
      data?: {
        userRates?: ShikimoriUserRate[];
      };
      errors?: Array<{ message?: string }>;
    };

    if (payload.errors?.length) {
      throw new Error(`Shikimori user rates GraphQL failed: ${payload.errors[0]?.message ?? 'unknown error'}`);
    }

    const pageRates = payload.data?.userRates ?? [];
    rates.push(...pageRates);

    if (pageRates.length < limit) {
      break;
    }
  }

  return rates;
}

function toPrismaWatchStatus(status: ReturnType<typeof fromShikimoriWatchStatus>) {
  switch (status) {
    case 'watching':
      return WatchStatus.WATCHING;
    case 'completed':
      return WatchStatus.COMPLETED;
    case 'dropped':
      return WatchStatus.DROPPED;
    case 'planned':
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
