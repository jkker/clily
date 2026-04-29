import { defineConfig } from 'vite-plus'

export default defineConfig({
  staged: {
    '*': ['vp check --fix', () => `vpx knip`],
    '*.{ts,tsx}': 'vp test related',
  },
  test: {
    coverage: {
      enabled: true,
    },
    projects: ['./packages/core'],
  },
  fmt: {
    ignorePatterns: ['dist', 'node_modules', 'pnpm-lock.yaml'],
    semi: false,
    singleQuote: true,
    sortPackageJson: true,
    sortImports: {
      partitionByComment: true,
      internalPattern: ['#/', '~/', '@/'],
    },
    sortTailwindcss: {
      functions: ['clsx', 'cn', 'cva'],
    },
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
    plugins: ['unicorn', 'eslint', 'typescript', 'oxc', 'import', 'promise', 'react', 'react-perf'],
    jsPlugins: [
      { name: 'react-hooks-js', specifier: 'eslint-plugin-react-hooks' },
      'eslint-plugin-react-you-might-not-need-an-effect',
    ],
    categories: { correctness: 'deny', suspicious: 'warn' },
    env: { builtin: true, es2026: true, browser: true },
    rules: {
      curly: ['warn', 'multi-or-nest'],
      'arrow-body-style': ['warn', 'as-needed'],
      'no-shadow': 0,
      'no-useless-rename': 'warn',
      'no-deprecated': 'warn',
      'no-var': 'deny',
      'no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      'import/export': 'deny',
      'import/no-duplicates': 'warn',
      'import/no-cycle': 'deny',
      'import/no-named-default': 'warn',
      'import/namespace': 0,
      'import/default': 0,
      'import/no-named-as-default-member': 0,
      'import/no-named-as-default': 0,
      'import/no-unassigned-import': [
        'warn',
        {
          allow: ['**/*.css', '**/*.d.ts'],
        },
      ],
      'typescript/no-inferrable-types': 'warn',
      'typescript/no-import-type-side-effects': 'deny',
      'typescript/array-type': ['warn', { default: 'array-simple' }],
      'typescript/no-empty-object-type': ['deny', { allowInterfaces: 'with-single-extends' }],
      'typescript/consistent-type-imports': [
        'deny',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports', disallowTypeAnnotations: false },
      ],
      'typescript/no-confusing-non-null-assertion': 'deny',
      'typescript/no-extraneous-class': 'deny',
      'typescript/no-explicit-any': 'deny',
      'typescript/no-redundant-type-constituents': 'warn',
      'typescript/no-useless-empty-export': 'warn',
      'typescript/prefer-as-const': 'warn',
      'typescript/no-this-alias': 'warn',
      'typescript/no-unsafe-argument': 'deny',
      'typescript/no-unsafe-assignment': 'deny',
      'typescript/no-unsafe-call': 'deny',
      'typescript/no-unsafe-member-access': 'deny',
      'typescript/no-unsafe-return': 'deny',
      'typescript/no-unsafe-type-assertion': 0,
      'typescript/prefer-function-type': 'deny',
      'typescript/prefer-nullish-coalescing': 'deny',
      'typescript/no-base-to-string': 'warn',
      'typescript/restrict-template-expressions': 'warn',
      'typescript/unbound-method': 'warn',

      'unicorn/no-array-for-each': 'warn',
      'unicorn/prefer-array-find': 'warn',
      'unicorn/require-post-message-target-origin': 0,

      'promise/param-names': 'deny',

      // React rules

      'react/rules-of-hooks': 'deny',
      'react/exhaustive-deps': 'warn',
      'react/only-export-components': 0,
      'react/react-in-jsx-scope': 0,
      'react/self-closing-comp': 'warn',
      'react/jsx-no-useless-fragment': 'warn',
      'react/button-has-type': 'warn',
      'react/jsx-fragments': 'warn',
      'react/jsx-boolean-value': 'warn',
      'react/jsx-curly-brace-presence': [
        'warn',
        { props: 'never', children: 'never', propElementValues: 'always' },
      ],

      // ref:
      // - https://github.com/TheAlexLichter/oxlint-react-compiler-rules/issues/1
      // - https://github.com/facebook/react/blob/main/packages/eslint-plugin-react-hooks/README.md#custom-configuration
      // Recommended rules (from LintRulePreset.Recommended)
      'react-hooks-js/config': 'deny',
      'react-hooks-js/error-boundaries': 'deny',
      'react-hooks-js/gating': 'deny',
      'react-hooks-js/globals': 'deny',
      'react-hooks-js/immutability': 'deny',
      'react-hooks-js/incompatible-library': 'warn',
      'react-hooks-js/preserve-manual-memoization': 'deny',
      'react-hooks-js/purity': 'deny',
      'react-hooks-js/refs': 'deny',
      'react-hooks-js/set-state-in-effect': 'warn',
      'react-hooks-js/set-state-in-render': 'deny',
      'react-hooks-js/static-components': 'deny',
      'react-hooks-js/unsupported-syntax': 'warn',
      'react-hooks-js/use-memo': 'deny',
      // Recommended-latest rules (from LintRulePreset.RecommendedLatest)
      'react-hooks-js/void-use-memo': 'deny',
      // https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect
      'react-you-might-not-need-an-effect/no-derived-state': 'warn',
      'react-you-might-not-need-an-effect/no-chain-state-updates': 'warn',
      'react-you-might-not-need-an-effect/no-event-handler': 'warn',
      'react-you-might-not-need-an-effect/no-adjust-state-on-prop-change': 'warn',
      'react-you-might-not-need-an-effect/no-reset-all-state-on-prop-change': 'warn',
      'react-you-might-not-need-an-effect/no-pass-live-state-to-parent': 'warn',
      'react-you-might-not-need-an-effect/no-pass-data-to-parent': 'warn',
      'react-you-might-not-need-an-effect/no-initialize-state': 'warn',
      'react-you-might-not-need-an-effect/no-empty-effect': 'warn',
    },
    settings: {
      vitest: {
        typecheck: true,
      },
      'jsx-a11y': {
        components: {},
        attributes: {},
      },
      react: {
        formComponents: [],
        linkComponents: ['Link'],
      },
    },
    overrides: [
      {
        files: ['**/*.{test,spec}.*', '*.d.ts'],
        plugins: ['vitest'],
        rules: {
          'import/no-unassigned-import': 0,
          'typescript/no-explicit-any': 0,
          'typescript/no-unsafe-argument': 0,
          'typescript/no-unsafe-assignment': 0,
          'typescript/no-unsafe-call': 0,
          'typescript/no-unsafe-member-access': 0,
          'typescript/no-unsafe-return': 0,
          'vitest/require-mock-type-parameters': 0,
        },
      },
    ],
    ignorePatterns: ['public', 'tmp', 'dist', 'build', 'node_modules'],
  },
  run: {
    tasks: {
      ready: {
        command: 'knip',
        dependsOn: ['check', 'test', '@clily/core#build'],
      },
    },
  },
})
