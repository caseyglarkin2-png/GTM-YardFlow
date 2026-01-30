/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // @ts-expect-error - vitest/vite version mismatch in types, works at runtime
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/workspaces/GTM-YardFlow/src',
      'virtual:pwa-register': '/workspaces/GTM-YardFlow/src/__tests__/mocks/pwa-register.ts',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      }
    }
  }
})
