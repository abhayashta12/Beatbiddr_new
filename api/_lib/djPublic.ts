/**
 * The public face of a DJ.
 *
 * users/{uid}.djProfile holds legal name, phone, address and email, so it can
 * never be readable by other people — the rules only let someone read their
 * own user document. Discovery needs a separate, deliberately thin mirror.
 *
 * Keep this allowlist as an allowlist. Adding a field here publishes it to
 * every signed-in user, so nothing from the identity set belongs in it.
 */

export interface DJPublic {
  uid: string;
  username: string;
  stageName: string;
  club: string;
  isLive: boolean;
  verified: boolean;
}

/** Fields of djProfile that may be mirrored publicly, and nothing else. */
export const PUBLIC_DJ_FIELDS = ['stageName', 'club', 'isLive'] as const;

export function buildDJPublic(
  uid: string,
  profile: Record<string, unknown>
): DJPublic {
  return {
    uid,
    username: typeof profile.username === 'string' ? profile.username : '',
    stageName: typeof profile.stageName === 'string' ? profile.stageName : '',
    club: typeof profile.club === 'string' ? profile.club : '',
    isLive: profile.isLive === true,
    verified: profile.verified === true,
  };
}
