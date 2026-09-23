'use strict';

// Small in-process limiter suitable for the current single-instance local server.
// Vercel instances do not share memory; use a shared store before relying on this
// limiter as the sole production abuse control across multiple serverless instances.
function createRateLimiter({ windowMs, max, message }) {
    const buckets = new Map();
    let cleanupAt = Date.now() + windowMs;

    return (req, res, next) => {
        const now = Date.now();
        if (now >= cleanupAt) {
            for (const [key, bucket] of buckets) {
                if (bucket.resetAt <= now) buckets.delete(key);
            }
            cleanupAt = now + windowMs;
        }
        const forwarded = req.headers['x-forwarded-for'];
        const clientIp = (req.ip || (forwarded ? String(forwarded).split(',')[0].trim() : '') || (req.socket && req.socket.remoteAddress) || 'unknown')
            .replace(/^::ffff:/, '');
        const key = (req.user && req.user.id) ? `user_${req.user.id}` : `ip_${clientIp}`;
        let bucket = buckets.get(key);
        if (!bucket || bucket.resetAt <= now) {
            bucket = { count: 0, resetAt: now + windowMs };
            buckets.set(key, bucket);
        }
        bucket.count += 1;
        res.setHeader('RateLimit-Limit', String(max));
        res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
        res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
        if (bucket.count > max) {
            res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
            return res.status(429).json({ success: false, message });
        }
        return next();
    };
}

module.exports = { createRateLimiter };
