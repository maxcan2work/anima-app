import { AuthProvider } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
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
    scope: '',
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
