import { describe, it, expect } from 'vitest';
import { isSpotifyImageUrl } from './validators';

/**
 * albumCover is attacker-supplied and ends up in an <img src> on the DJ's
 * dashboard. An unvalidated URL leaks the DJ's IP and user-agent to whoever
 * sent the request, and tells them when the DJ looked at their queue.
 *
 * The usual way an allowlist like this fails is a substring check, so most of
 * these cases are hosts that *contain* the right string without being it.
 */

describe('isSpotifyImageUrl: accepts real Spotify artwork', () => {
  it.each([
    'https://i.scdn.co/image/ab67616d0000b273abcdef',
    'https://mosaic.scdn.co/640/abc',
    'https://image-cdn-ak.scdn.co/image/xyz',
    'https://I.SCDN.CO/image/upper',
  ])('accepts %s', (url) => {
    expect(isSpotifyImageUrl(url)).toBe(true);
  });
});

describe('isSpotifyImageUrl: rejects everything else', () => {
  it.each([
    ['a plain attacker host', 'https://evil.com/pixel.gif'],
    ['a suffix-confusion host', 'https://i.scdn.co.evil.com/pixel.gif'],
    ['the string in the path', 'https://evil.com/i.scdn.co/pixel.gif'],
    ['the string in the query', 'https://evil.com/p.gif?host=i.scdn.co'],
    ['a userinfo field before an @', 'https://i.scdn.co@evil.com/p.gif'],
    ['the string in a fragment', 'https://evil.com/p.gif#i.scdn.co'],
    ['a lookalike without the dot', 'https://iscdn.co/image/x'],
    ['a host merely ending in those letters', 'https://notscdn.co/image/x'],
    ['plain http', 'http://i.scdn.co/image/x'],
    ['a javascript URI', 'javascript:alert(1)'],
    ['a data URI', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='],
    ['a protocol-relative URL', '//i.scdn.co/image/x'],
    ['a bare path', '/image/x'],
    ['nonsense', 'not a url at all'],
    ['empty', ''],
  ])('rejects %s', (_label, url) => {
    expect(isSpotifyImageUrl(url)).toBe(false);
  });
});
