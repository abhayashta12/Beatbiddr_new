import { useEffect, useState } from 'react';

/**
 * Whether this device should render the WebGL hero animation.
 *
 * The animation is decorative, but it costs a ~900 KB three.js download plus
 * continuous GPU work. On phones that turned a landing page into a multi-minute
 * load, so they get the CSS gradient version instead — which is what the design
 * mostly reads as anyway.
 *
 * Starts false so nothing heavy is scheduled during the first paint; a capable
 * device opts in on the next tick.
 */
export const useCanRender3D = (): boolean => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isSmallScreen = window.matchMedia('(max-width: 900px)').matches;

    // deviceMemory is Chromium-only; when absent we fall back to core count.
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const lowMemory = typeof memory === 'number' && memory <= 4;
    const fewCores =
      typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;

    if (prefersReducedMotion || isSmallScreen || lowMemory || fewCores) return;

    setEnabled(true);
  }, []);

  return enabled;
};
