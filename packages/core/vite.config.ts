import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    dts: {
      tsgo: true,
    },
    exports: {
      devExports: 'source',
      packageJson: true,
    },
  },
  test: {
    typecheck: {
      enabled: true,
      checker: 'tsgo',
    },
  },
})
