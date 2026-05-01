import crypto from 'crypto';

if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
  throw new Error(
    'DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET must be set in environment variables'
  );
}

const DISCORD_AUTHORIZE_URL = 'https://discord.com/api/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_USER_URL = 'https://discord.com/api/users/@me';
const SCOPES = 'identify';

const getCallbackUrl = (): string => {
  if (process.env.DISCORD_CALLBACK_URL) {
    if (process.env.DISCORD_CALLBACK_URL.startsWith('http')) {
      return process.env.DISCORD_CALLBACK_URL;
    }
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    return `${baseUrl}${process.env.DISCORD_CALLBACK_URL}`;
  }
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  return `${baseUrl}/api/auth/discord/callback`;
};

export function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    redirect_uri: getCallbackUrl(),
    response_type: 'code',
    scope: SCOPES,
    state,
    prompt: 'consent',
  });
  return `${DISCORD_AUTHORIZE_URL}?${params.toString()}`;
}

export interface DiscordTokens {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
}

export async function getTokens(code: string): Promise<DiscordTokens> {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    client_secret: process.env.DISCORD_CLIENT_SECRET!,
    grant_type: 'authorization_code',
    code,
    redirect_uri: getCallbackUrl(),
  });

  const response = await fetch(DISCORD_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord token exchange failed: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<DiscordTokens>;
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  discriminator: string;
  avatar: string | null;
}

export async function getUserInfo(tokens: DiscordTokens): Promise<DiscordUser> {
  const response = await fetch(DISCORD_USER_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord user fetch failed: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<DiscordUser>;
}
