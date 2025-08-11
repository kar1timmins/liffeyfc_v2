import type { Config } from 'tailwindcss';
import daisyui from 'daisyui';
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';

const config = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      animation: {
        fade: 'fadeIn 1s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      },
    },
  },

  plugins: [
    forms,
    typography,
    daisyui,
  ],
  daisyui: {
    themes: [
      'light',
      'dark',
    ],
  },
} satisfies Config & { daisyui: unknown };

export default config;