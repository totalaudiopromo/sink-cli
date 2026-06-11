import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['src/ui/tui/**'],
      // Ratchet floor pinned at measured levels (June 2026). Raise as coverage
      // improves; never lower. Overall % is dragged down by the CLI shell and
      // UI formatting -- core pipeline logic sits near 100%. The functions
      // floor is intentionally loose: v8 counts every column-getter arrow in
      // output/csv.ts as a function, so the metric is noisy.
      thresholds: {
        statements: 46,
        branches: 82,
        functions: 72,
        lines: 46,
      },
    },
  },
})
