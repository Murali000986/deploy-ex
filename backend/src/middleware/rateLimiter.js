// Simple in-memory sliding window rate limiter
const requestCounts = new Map();

export function rateLimiter({ windowMs = 60000, maxRequests = 120 } = {}) {
  return (req, res, next) => {
    const key = req.ip || req.headers['x-forwarded-for'] || 'client_ip';
    const now = Date.now();

    if (!requestCounts.has(key)) {
      requestCounts.set(key, []);
    }

    const timestamps = requestCounts.get(key).filter(ts => now - ts < windowMs);
    if (timestamps.length >= maxRequests) {
      return res.status(429).json({
        error: 'TooManyRequests',
        message: 'Rate limit exceeded. Please try again shortly.'
      });
    }

    timestamps.push(now);
    requestCounts.set(key, timestamps);
    next();
  };
}
