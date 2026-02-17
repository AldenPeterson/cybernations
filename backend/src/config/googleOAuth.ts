import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error(
    'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment variables'
  );
}

// Build the full callback URL
const getCallbackUrl = (): string => {
  if (process.env.GOOGLE_CALLBACK_URL) {
    // If it's already a full URL, use it
    if (process.env.GOOGLE_CALLBACK_URL.startsWith('http')) {
      return process.env.GOOGLE_CALLBACK_URL;
    }
    // If it's just a path, prepend the base URL
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    return `${baseUrl}${process.env.GOOGLE_CALLBACK_URL}`;
  }
  // Default fallback
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  return `${baseUrl}/api/auth/google/callback`;
};

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  getCallbackUrl()
);

/**
 * Generate random state string for CSRF protection
 */
export function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate Google OAuth authorization URL with state parameter
 */
export function getAuthUrl(state: string): string {
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state,
    prompt: 'consent',
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokens(code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  return tokens;
}

/**
 * Get user profile from Google using ID token
 */
export async function getUserInfo(tokens: { id_token?: string | null }) {
  if (!tokens.id_token) {
    throw new Error('No ID token available');
  }

  const ticket = await oauth2Client.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error('Failed to get user info from Google');
  }

  return {
    sub: payload.sub,
    email: payload.email || '',
    email_verified: payload.email_verified || false,
    name: payload.name,
    picture: payload.picture,
  };
}

