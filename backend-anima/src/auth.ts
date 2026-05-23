import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authCookieName, config } from './config.js';
import { prisma } from './db.js';

type SessionPayload = {
  sub: string;
};

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function signSession(userId: string) {
  return jwt.sign({ sub: userId } satisfies SessionPayload, config.JWT_SECRET, {
    expiresIn: '30d',
  });
}

export function setSessionCookie(response: Response, token: string) {
  response.cookie(authCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie(response: Response) {
  response.clearCookie(authCookieName);
}

export async function optionalAuth(request: Request, _response: Response, next: NextFunction) {
  const token = request.cookies?.[authCookieName];
  if (!token) {
    next();
    return;
  }

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as SessionPayload;
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true } });
    request.userId = user?.id;
  } catch {
    request.userId = undefined;
  }

  next();
}

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  if (!request.userId) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}
