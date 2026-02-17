import { Router, Request, Response } from 'express';
import { findOrCreateUser, getManagedAlliances } from '../services/authService.js';
import { getAuthUrl, generateState, getTokens, getUserInfo } from '../config/googleOAuth.js';
import { prisma } from '../utils/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const authRoutes = Router();

/**
 * Initiate Google OAuth flow
 */
authRoutes.get('/google', (req: Request, res: Response) => {
  try {
    // Generate random state parameter for CSRF protection
    const state = generateState();
    
    // Store state in session
    req.session.oauthState = state;
    
    console.log('OAuth initiation:', {
      sessionId: req.sessionID,
      state: state.substring(0, 8) + '...', // Log first 8 chars for debugging
      hasOAuthState: !!req.session.oauthState,
    });
    
    // Save session before redirect to ensure it's persisted
    req.session.save((err) => {
      if (err) {
        console.error('Error saving session during OAuth initiation:', err);
        return res.status(500).json({
          success: false,
          error: 'Failed to initiate authentication',
        });
      }
      
      // Generate OAuth URL with state
      const authUrl = getAuthUrl(state);
      
      console.log('Session saved, redirecting to Google OAuth');
      
      // Redirect to Google
      res.redirect(authUrl);
    });
  } catch (error) {
    console.error('Error initiating OAuth flow:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate authentication',
    });
  }
});

/**
 * Handle Google OAuth callback
 */
authRoutes.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    // Verify state parameter
    if (!state) {
      console.error('OAuth callback missing state parameter');
      return res.status(400).json({
        success: false,
        error: 'Missing state parameter',
      });
    }

    // Check if session has oauthState
    if (!req.session.oauthState) {
      console.error('OAuth callback: Session missing oauthState', {
        sessionId: req.sessionID,
        hasSession: !!req.session,
        sessionKeys: Object.keys(req.session),
        cookies: req.headers.cookie,
        sessionCookie: req.session.cookie,
        sessionStore: req.sessionStore ? 'present' : 'missing',
      });
      
      // If this is a fresh session (no session data at all), it might be a cookie mismatch
      // This can happen when switching from MemoryStore to PostgreSQL store
      if (Object.keys(req.session).length === 0) {
        console.error('OAuth callback: Empty session detected - possible cookie mismatch from store migration');
      }
      
      return res.status(400).json({
        success: false,
        error: 'Session expired or invalid. Please try logging in again.',
        hint: 'If you just switched to database sessions, please clear your cookies and try again.',
      });
    }

    if (state !== req.session.oauthState) {
      console.error('OAuth callback: State mismatch', {
        receivedState: state,
        expectedState: req.session.oauthState,
        sessionId: req.sessionID,
      });
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

    // Exchange code for tokens
    console.log('Exchanging code for tokens...');
    const tokens = await getTokens(code);
    console.log('Got tokens, has id_token:', !!tokens.id_token);

    // Get user info from Google
    console.log('Getting user info from Google...');
    const googleProfile = await getUserInfo(tokens);
    console.log('Got Google profile:', {
      sub: googleProfile.sub,
      email: googleProfile.email,
      name: googleProfile.name,
    });

    // Find or create user in database
    console.log('Finding or creating user in database...');
    const user = await findOrCreateUser(googleProfile);
    console.log('User found/created:', {
      id: user.id,
      email: user.email,
      googleId: user.googleId,
    });

    // For now, skip regeneration to test if that's the issue
    // TODO: Re-enable regeneration once we confirm session persistence works
    const oldSessionId = req.sessionID;
    console.log('Before setting userId - sessionId:', oldSessionId);
    
    // Store user ID directly in session (without regeneration for testing)
    req.session.userId = user.id;
    console.log('Set userId in session:', user.id);
    console.log('Session immediately after setting:', {
      sessionId: req.sessionID,
      userId: req.session.userId,
      hasUserId: 'userId' in req.session,
      allKeys: Object.keys(req.session),
    });
    
    // Alternative: Try regenerating AFTER setting userId to see if that helps
    // Actually, let's try without regeneration first to isolate the issue

    // Clear OAuth state
    delete req.session.oauthState;

    // Mark session as modified to ensure it gets saved
    req.session.cookie.maxAge = parseInt(process.env.SESSION_MAX_AGE || '604800000', 10);
    
    // Save session explicitly
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('Error saving session:', err);
          reject(err);
        } else {
          console.log('Session saved - verifying data is still there:');
          console.log({
            sessionId: req.sessionID,
            userId: req.session.userId,
            userIdType: typeof req.session.userId,
            userIdValue: req.session.userId,
            allSessionKeys: Object.keys(req.session),
            sessionCookie: req.session.cookie,
          });
          resolve();
        }
      });
    });
    
    // One more verification before redirect
    if (!req.session.userId) {
      console.error('WARNING: userId is missing from session after save!');
      console.error('Session object:', JSON.stringify(req.session, null, 2));
    } else {
      console.log('✓ userId confirmed in session before redirect:', req.session.userId);
    }

    // Redirect to frontend with success
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}?auth=success`);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}?auth=error&message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
  }
});

/**
 * Logout - destroys session
 */
authRoutes.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
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
        email: true,
        role: true,
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

    // Get managed alliance IDs
    const managedAllianceIds = await getManagedAlliances(userId);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        rulerName: user.rulerName,
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

    // Update only the rulerName field
    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { rulerName: trimmedRulerName },
        select: {
          id: true,
          email: true,
          role: true,
          rulerName: true,
        },
      });

      res.json({
        success: true,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
          rulerName: updatedUser.rulerName,
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

