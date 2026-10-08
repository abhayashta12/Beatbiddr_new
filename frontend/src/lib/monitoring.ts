/**
 * Error reporting.
 *
 * Deliberately not Sentry's SDK: that is ~30kB of JavaScript on a page we
 * spent real effort shrinking, for a pre-launch app. This posts to Sentry's
 * ingest endpoint directly over its public "store" API, which needs no
 * library.
 *
 * With no VITE_SENTRY_DSN set it is inert — no requests, no console noise —
 * so the app behaves identically until a DSN exists.
 */

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

interface ParsedDSN {
  url: string;
  key: string;
}

/** A DSN looks like https://<key>@<host>/<projectId>. */
function parseDSN(dsn: string): ParsedDSN | null {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, '');
    if (!url.username || !projectId) return null;
    return {
      url: `${url.protocol}//${url.host}/api/${projectId}/store/`,
      key: url.username,
    };
  } catch {
    return null;
  }
}

const target = DSN ? parseDSN(DSN) : null;

/** Don't let a reporting failure become its own error loop. */
let sending = false;

function send(payload: Record<string, unknown>): void {
  if (!target || sending) return;
  sending = true;
  fetch(target.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${target.key}`,
    },
    body: JSON.stringify({
      platform: 'javascript',
      timestamp: new Date().toISOString(),
      release: import.meta.env.VITE_COMMIT_SHA ?? 'dev',
      ...payload,
    }),
    // Reporting must never hold up navigation.
    keepalive: true,
  })
    .catch(() => {
      /* swallowed on purpose — see above */
    })
    .finally(() => {
      sending = false;
    });
}

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!target) return;
  const err = error instanceof Error ? error : new Error(String(error));
  send({
    level: 'error',
    exception: {
      values: [{ type: err.name, value: err.message, stacktrace: { frames: [] } }],
    },
    extra: { ...context, stack: err.stack?.slice(0, 4000) },
  });
}

/**
 * Catches what a try/catch cannot: errors thrown outside our handlers and
 * promise rejections nothing awaited. This is the class of failure that has
 * been invisible so far.
 */
export function initMonitoring(): void {
  if (!target) return;

  window.addEventListener('error', (event) => {
    reportError(event.error ?? event.message, { source: 'window.onerror' });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, { source: 'unhandledrejection' });
  });
}
