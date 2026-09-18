import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Reports the currently deployed build so running clients can detect that a
 * newer version has shipped. Must never be cached — a stale answer here would
 * defeat the entire mechanism.
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.status(200).json({
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev',
  });
}
