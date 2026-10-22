import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Reports the currently deployed build so running clients can detect that a
 * newer version has shipped. Must never be cached — a stale answer here would
 * defeat the entire mechanism.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.status(200).json({
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev',
  });
}
