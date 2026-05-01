import { Router, Request, Response } from 'express';
import { findOrCreateUser, getEffectiveCapabilities, getUserRoles } from '../services/authService.js';
import { getAuthUrl, generateState, getTokens, getUserInfo } from '../config/discordOAuth.js';
import { prisma } from '../utils/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getClearCookieOptions } from '../utils/cookieConfig.js';

export const authRoutes = Router();

/**
 * Initiate Discord OAuth flow
 */
authRoutes.get('/discord', (req: Request, res: Response) => {
  try {
    const state = generateState();
    req.session.oauthState = state;
    const authUrl = getAuthUrl(state);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating OAuth flow:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate authentication',
    });
  }
});

/**
 * Handle Discord OAuth callback
 */
authRoutes.get('/discord/callback', async (req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  try {
    const { code, state } = req.query;

    if (!state) {
      console.error('OAuth callback missing state parameter');
      return res.status(400).json({
        success: false,
        error: 'Missing state parameter',
      });
    }

    if (!req.session.oauthState) {
      console.error('OAuth callback: Session missing oauthState');
      return res.status(400).json({
        success: false,
        error: 'Session expired or invalid. Please try logging in again.',
      });
    }

    if (state !== req.session.oauthState) {
      console.error('OAuth callback: State mismatch');
      return res.status(400).json({
        success: false,
        error: 'Invalid state parameter. Please try logging in again.',
      });
    }

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required',
      });
    }

    const tokens = await getTokens(code);
    const discordUser = await getUserInfo(tokens);

    const user = await findOrCreateUser({
      id: discordUser.id,
      username: discordUser.username,
      global_name: discordUser.global_name,
    });

    req.session.userId = user.id;
    delete req.session.oauthState;

    res.redirect(`${frontendUrl}?auth=success`);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.redirect(`${frontendUrl}?auth=error&message=${encodeURIComponent(message)}`);
  }
});

/**
 * Legacy Google OAuth entrypoints — gone. Tell the client to use Discord.
 */
authRoutes.get('/google', (_req: Request, res: Response) => {
  res.status(410).json({
    success: false,
    error: 'Google sign-in has been replaced by Discord. Please sign in with Discord.',
  });
});

authRoutes.get('/google/callback', (_req: Request, res: Response) => {
  res.status(410).json({
    success: false,
    error: 'Google sign-in has been replaced by Discord. Please sign in with Discord.',
  });
});

/**
 * Logout - destroys session and clears session cookie
 */
authRoutes.post('/logout', (req: Request, res: Response) => {
  const sessionCookieName = process.env.SESSION_NAME || 'sessionId';
  const cookieOptions = getClearCookieOptions();

  req.session.destroy((err) => {
    // Clear the session cookie from the client
    res.clearCookie(sessionCookieName, cookieOptions);

    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to logout',
      });
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  });
});

/**
 * Get current user info
 * Returns user if authenticated, or null if not authenticated
 */
authRoutes.get('/me', async (req: Request, res: Response) => {
  try {
    // Check if user is authenticated
    if (!req.session.userId) {
      return res.json({
        success: true,
        user: null,
      });
    }

    const userId = req.session.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        discordUsername: true,
        rulerName: true,
      },
    });

    if (!user) {
      // User ID in session but user doesn't exist - clear session
      req.session.destroy(() => {});
      return res.json({
        success: true,
        user: null,
      });
    }

    const [roles, { capabilities, managedAllianceIds }] = await Promise.all([
      getUserRoles(userId),
      getEffectiveCapabilities(userId),
    ]);

    res.json({
      success: true,
      user: {
        id: user.id,
        discordUsername: user.discordUsername,
        rulerName: user.rulerName,
        roles,
        capabilities,
        managedAllianceIds,
      },
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user info',
    });
  }
});

/**
 * Verify session validity
 */
authRoutes.get('/verify', (req: Request, res: Response) => {
  res.json({
    success: true,
    authenticated: true,
  });
});

/**
 * Update user's rulerName
 * Only updates the rulerName field in the users table
 * Uses requireAuth middleware to ensure only the authenticated user can update their own rulerName
 */
authRoutes.post('/update-rulername', requireAuth, async (req: Request, res: Response) => {
  try {
    const { rulerName } = req.body;

    // Validate rulerName
    if (!rulerName || typeof rulerName !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Ruler name is required and must be a string',
      });
    }

    // Trim and validate length
    const trimmedRulerName = rulerName.trim();
    if (trimmedRulerName.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Ruler name cannot be empty',
      });
    }

    if (trimmedRulerName.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Ruler name must be 100 characters or less',
      });
    }

    const userId = req.session.userId;
    if (userId == null) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { rulerName: trimmedRulerName },
        select: {
          id: true,
          discordUsername: true,
          rulerName: true,
        },
      });

      const [roles, { capabilities, managedAllianceIds }] = await Promise.all([
        getUserRoles(userId),
        getEffectiveCapabilities(userId),
      ]);

      res.json({
        success: true,
        user: {
          id: updatedUser.id,
          discordUsername: updatedUser.discordUsername,
          rulerName: updatedUser.rulerName,
          roles,
          capabilities,
          managedAllianceIds,
        },
      });
    } catch (error: any) {
      // Handle unique constraint violation (rulerName must be unique)
      if (error.code === 'P2002' && error.meta?.target?.includes('ruler_name')) {
        return res.status(409).json({
          success: false,
          error: 'This ruler name is already taken. Please choose a different one.',
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error updating ruler name:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update ruler name',
    });
  }
});

