import { Request, Response, NextFunction } from 'express';

/**
 * Centralized error handling middleware
 */
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error occurred:', err.stack);
  
  // Default error response
  const errorResponse = {
    success: false,
    error: 'Something went wrong!'
  };

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      ...errorResponse,
      error: 'Validation error',
      details: err.message
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      ...errorResponse,
      error: 'Unauthorized'
    });
  }

  if (err.name === 'NotFoundError') {
    return res.status(404).json({
      ...errorResponse,
      error: 'Resource not found'
    });
  }

  // Default to 500 error
  res.status(500).json(errorResponse);
};

/**
 * 404 handler for unmatched routes
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
};
