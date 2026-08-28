import { defineConfig } from 'vitest/config';

// Zonder de lege postcss-sleutel klimt vite omhoog en pakt hij de postcss-config
// van de WK-app in de repo-root op, die tailwind verwacht dat hier niet staat.
export default defineConfig({
  css: { postcss: {} },
  test: {
    include: ['lib/**/*.test.ts'],
    environment: 'node',
  },
});
