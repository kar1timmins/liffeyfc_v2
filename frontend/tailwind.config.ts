import type { Config } from 'tailwindcss';

const config: Config = {
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
    require('daisyui')({
      themes: [
        {
          startup: {
            primary: '#4f46e5',
            secondary: '#0ea5e9',
            accent: '#facc15',
            neutral: '#1e293b',
            'base-100': '#ffffff',
          },
        },
      ],
    }),
  ],
};

export default config;