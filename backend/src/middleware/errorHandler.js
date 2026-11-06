/**
 * Centralized sanitized error handler.
 * Strips internal stack traces, system paths, and sensitive tokens.
 */
export function errorHandler(err, req, res, next) {
  // Safe console log without tokens
  const sanitizedMessage = (err.message || 'Unknown Server Error').replace(
    /(EAAG[A-Za-z0-9_-]+|[0-9a-f]{32}|Bearer\s+[A-Za-z0-9_.-]+)/gi,
    '[REDACTED]'
  );

  console.error(`[Error] [${req.method} ${req.url}] ${sanitizedMessage}`);

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: err.name || 'InternalServerError',
    message: statusCode === 500 ? 'An unexpected error occurred while processing the request.' : sanitizedMessage,
    requestId: req.headers['x-request-id'] || undefined
  });
}
