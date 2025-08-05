import { quintOut } from 'svelte/easing';
import { crossfade } from 'svelte/transition';

// Custom river effect: a wavy mask reveal
export function river(node: Element, { delay = 0, duration = 1200 } = {}) {
  return {
    delay,
    duration,
    css: (t: number) => {
      // Horizontal (left-to-right) wavy reveal
      const wave = 32 * Math.sin(t * Math.PI * 3);
      const x = 100 - t * 100;
      return `
        clip-path: polygon(
          0% 0%,
          calc(${x}% + ${wave}px) 0%,
          calc(${x}% - ${wave}px) 100%,
          0% 100%
        );
        opacity: ${t};
        background: white;
        will-change: clip-path, opacity;
        transition: clip-path ${duration}ms cubic-bezier(0.4,0,0.2,1), opacity ${duration}ms;`
    }
  };
}
