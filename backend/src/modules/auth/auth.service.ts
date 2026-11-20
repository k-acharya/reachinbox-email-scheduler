import crypto from 'crypto';
import axios from 'axios';
import { env } from '../../config/env';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';

interface GoogleTokenResponse {
  access_token: string;
  id_token?: string;
}

interface GoogleUserProfile {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export function buildGoogleAuthUrl(): { url: string; state: string } {
  const state = crypto.randomBytes(24).toString('hex');
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    state,
  };
}

export async function handleGoogleOAuthCallback(code: string) {
  const tokenParams = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: env.GOOGLE_CALLBACK_URL,
    grant_type: 'authorization_code',
  });

  const tokenRes = await axios.post<GoogleTokenResponse>(
    'https://oauth2.googleapis.com/token',
    tokenParams.toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  const accessToken = tokenRes.data.access_token;
  if (!accessToken) {
    throw new AppError('Failed to obtain Google access token', 401);
  }

  const profileRes = await axios.get<GoogleUserProfile>(
    'https://openidconnect.googleapis.com/v1/userinfo',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const profile = profileRes.data;
  if (!profile.sub || !profile.email) {
    throw new AppError('Incomplete Google user profile', 400);
  }

  return prisma.user.upsert({
    where: { googleId: profile.sub },
    update: {
      email: profile.email,
      name: profile.name || profile.email.split('@')[0],
      avatar: profile.picture || null,
    },
    create: {
      googleId: profile.sub,
      email: profile.email,
      name: profile.name || profile.email.split('@')[0],
      avatar: profile.picture || null,
    },
  });
}