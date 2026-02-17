/**
 * Centralized cookie configuration utility
 * Provides consistent cookie settings across the application
 */

export interface CookieOptions {
  maxAge?: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path?: string;
  domain?: string;
}

/**
 * Get cookie configuration based on environment
 */
export function getCookieConfig(): CookieOptions {
  const cookieSecure = process.env.COOKIE_SECURE === 'true';
  const sessionMaxAge = parseInt(process.env.SESSION_MAX_AGE || '604800000', 10); // 7 days default

  return {
    maxAge: sessionMaxAge,
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSecure ? 'none' : 'lax',
    path: '/',
  };
}

/**
 * Get cookie options for clearing cookies (logout)
 * Uses the same settings as session cookies for consistency
 */
export function getClearCookieOptions(): {
  path: string;
  domain?: string;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  httpOnly: boolean;
} {
  const config = getCookieConfig();
  return {
    path: config.path || '/',
    domain: config.domain,
    secure: config.secure,
    sameSite: config.sameSite,
    httpOnly: config.httpOnly,
  };
}

