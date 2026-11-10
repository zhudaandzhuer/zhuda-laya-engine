import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default [
  { ignores: ['**/node_modules/**', 'vendor/**', 'dist/**', 'packages/types/**', '**/dist/**', 'src/.generated/**', 'examples/windows-webgpu/web/**'] },
  {
    files: ['**/*.mjs', '**/*.js', '**/*.ts'],
    languageOptions: { parser: tseslint.parser, globals: { ...globals.node, ...globals.browser, Laya: 'readonly' } },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-dupe-class-members': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-prototype-builtins': 'error',
      'no-unsafe-finally': 'error'
    }
  }
];
