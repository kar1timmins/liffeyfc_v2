
// Custom river effect: a wavy mask reveal
export function river(node: Element, { delay = 0, duration = 600 } = {}) {
  return {
    delay,
    duration,
    css: (t: number) => `
      opacity: ${t};
      transition: opacity ${duration}ms cubic-bezier(0.4,0,0.2,1);
    `
  };
}
