import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 10000,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/accounting/**/*.ts', 'src/lib/notifications/**/*.ts', 'src/lib/financial-health/**/*.ts', 'src/lib/dashboard/**/*.ts', 'src/lib/data-integrity/**/*.ts', 'src/lib/scenarios/**/*.ts', 'src/lib/reports/**/*.ts', 'src/lib/affordability/home/**/*.ts', 'src/lib/affordability/travel/**/*.ts', 'src/lib/decision-comparison/**/*.ts', 'src/app/api/affordability/compare/*.ts', 'src/app/**/affordability/compare/*.ts'],
      exclude: ['**/*.test.ts', '**/service.ts', '**/preferences-service.ts', '**/snapshot-service.ts', '**/persistence.ts'],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
})
