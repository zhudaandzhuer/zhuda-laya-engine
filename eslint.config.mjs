import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// What a name left unused may look like: a leading underscore says it is unused on purpose
// (a parameter kept for its position, a value taken out of an object to leave it out of the rest).
const unused = {
  args: 'after-used',
  argsIgnorePattern: '^_',
  varsIgnorePattern: '^_',
  caughtErrorsIgnorePattern: '^_',
  destructuredArrayIgnorePattern: '^_',
  ignoreRestSiblings: true,
};

export default [
  {
    ignores: [
      '**/node_modules/**',
      'vendor/**',
      'dist/**',
      'packages/types/**',
      '**/dist/**',
      'src/.generated/**',
      'examples/windows-webgpu/web/**',
    ],
  },
  {
    files: ['**/*.mjs', '**/*.js', '**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      // Tools run in Node and hand functions to a page, so both sets of names are known here.
      globals: { ...globals.node, ...globals.browser, Laya: 'readonly' },
    },
    rules: {
      ...js.configs.recommended.rules,
      // An empty block needs a comment that says why nothing is done, a catch included.
      'no-empty': 'error',
      'no-prototype-builtins': 'error',
      'no-unsafe-finally': 'error',
    },
  },
  {
    // TypeScript: the compiler already refuses an unknown name and a second member of the same
    // name (and knows overloads), so those two rules stay with it. Unused names are the
    // typescript-eslint rule's, which understands types and overloads.
    files: ['**/*.ts'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      'no-undef': 'off',
      'no-dupe-class-members': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', unused],
    },
  },
  {
    // Plain JavaScript has no compiler behind it: an unknown name is caught here.
    files: ['**/*.mjs', '**/*.js'],
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', unused],
    },
  },
  {
    // What runs in a player's browser does not reach for Node.
    files: ['packages/core/**/*.ts', 'src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['process', 'Buffer', '__dirname', '__filename', 'global'].map((name) => ({
          name,
          message: 'This code runs in a browser; Node is not there.',
        })),
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['node:*'], message: 'This code runs in a browser; Node is not there.' },
          ],
        },
      ],
    },
  },
  {
    // `runBrandSplash` is written into every built page with `toString()`: a comment inside it
    // would be shipped in each of them, so its one empty catch stays bare. It is there because a
    // page without a working `Event` must still lose its splash.
    files: ['packages/compiler/branding.mjs'],
    rules: { 'no-empty': ['error', { allowEmptyCatch: true }] },
  },
  {
    // An audio worklet has its own global scope.
    files: ['tests/fixtures/runtime-worklet.js'],
    languageOptions: { globals: { ...globals.audioWorklet } },
  },
];
