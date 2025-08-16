import { cubicOut, cubicInOut } from 'svelte/easing';
import { crossfade, fade } from 'svelte/transition';

export const ease = cubicOut;
export const crossEase = cubicInOut;
export const dur = {
  fast: 260,
  base: 440,
  slow: 620,
  routeOut: 620,
  crossfade: 520
} as const;

// Simple opacity route transition
export function routeOpacity(node: Element, { delay = 0, duration = dur.routeOut } = {}) {
  return {
    delay,
    duration,
    css: (t: number) => `opacity:${t};transition:opacity ${duration}ms cubic-bezier(0.4,0,0.2,1);`
  };
}

// Disable intro on first render; use given transition after mount
export function noIntro<T extends (node: Element, params?: any) => any>(
  isMounted: () => boolean,
  transitionFactory: T,
  params?: Parameters<T>[1]
) {
  return (node: Element, p?: Parameters<T>[1]) => (isMounted() ? transitionFactory(node, p ?? params) : { duration: 0 });
}

// Standard crossfade with zero-duration fallback before mount
export function makeCrossfade(
  isMounted: () => boolean,
  options?: { duration?: number; fallbackDuration?: number; easing?: (t: number) => number }
) {
  const duration = options?.duration ?? dur.crossfade;
  const fallbackDuration = options?.fallbackDuration ?? dur.fast;
  return crossfade({
    duration,
    easing: options?.easing ?? crossEase,
  // Before mount: return a no-op transition to avoid any intro style twitches
  // After mount: use a light fade as a fallback when pairs don't match
  fallback: (node) => (isMounted() ? fade(node, { duration: fallbackDuration }) : { duration: 0 })
  });
}
