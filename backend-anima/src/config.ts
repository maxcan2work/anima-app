import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(24),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_REDIRECT_URI: z.string().url().optional(),
  SHIKIMORI_BASE_URL: z.string().url().default('https://shikimori.io'),
  SHIKIMORI_CLIENT_ID: z.string().optional(),
  SHIKIMORI_CLIENT_SECRET: z.string().optional(),
  SHIKIMORI_REDIRECT_URI: z.string().url().default('http://localhost:4000/auth/shikimori/callback'),
});

export const config = envSchema.parse(process.env);

export const authCookieName = 'anima_session';
