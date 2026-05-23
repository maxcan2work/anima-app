import { AuthProvider } from '@prisma/client';
import { config } from './config.js';
import { prisma } from './db.js';

type DiscordTokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
};

type DiscordUserResponse = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

export function getDiscordAuthUrl() {
  assertDiscordConfigured();

  const params = new URLSearchParams({
    client_id: config.DISCORD_CLIENT_ID!,
    redirect_uri: config.DISCORD_REDIRECT_URI!,
    response_type: 'code',
    scope: 'identify',
    prompt: 'none',
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeDiscordCode(code: string) {
  assertDiscordConfigured();

  const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.DISCORD_CLIENT_ID!,
      client_secret: config.DISCORD_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.DISCORD_REDIRECT_URI!,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Discord token request failed: ${tokenResponse.status}`);
  }

  const token = (await tokenResponse.json()) as DiscordTokenResponse;

  const profileResponse = await fetch('https://discord.com/api/users/@me', {
    headers: {
      Authorization: `${token.token_type} ${token.access_token}`,
    },
  });

  if (!profileResponse.ok) {
    throw new Error(`Discord profile request failed: ${profileResponse.status}`);
  }

  const profile = (await profileResponse.json()) as DiscordUserResponse;
  const avatarUrl = profile.avatar
    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=128`
    : null;

  const account = await prisma.authAccount.findUnique({
    where: {
      provider_providerUserId: {
        provider: AuthProvider.DISCORD,
        providerUserId: profile.id,
      },
    },
    include: { user: true },
  });

  if (account) {
    await prisma.authAccount.update({
      where: { id: account.id },
      data: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
      },
    });

    await prisma.user.update({
      where: { id: account.userId },
      data: {
        displayName: profile.global_name ?? profile.username,
        avatarUrl,
      },
    });

    return account.userId;
  }

  const user = await prisma.user.create({
    data: {
      displayName: profile.global_name ?? profile.username,
      avatarUrl,
      accounts: {
        create: {
          provider: AuthProvider.DISCORD,
          providerUserId: profile.id,
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
        },
      },
    },
  });

  return user.id;
}

function assertDiscordConfigured() {
  if (!config.DISCORD_CLIENT_ID || !config.DISCORD_CLIENT_SECRET || !config.DISCORD_REDIRECT_URI) {
    throw new Error('Discord OAuth is not configured');
  }
}
