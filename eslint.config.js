// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const prettier = require('eslint-config-prettier');

/**
 * Architecture boundaries (enforced, not just documented):
 *   core     → may not import shared / layout / features
 *   shared   → may not import layout / features
 *   layout   → may not import features
 *   features → may not import another feature (use relative paths inside a feature)
 */
const boundary = (patterns, message) => ({
  'no-restricted-imports': ['error', { patterns: [{ group: patterns, message }] }],
});

module.exports = tseslint.config(
  { ignores: ['dist/', 'coverage/', '.angular/', 'node_modules/'] },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
      prettier,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@angular-eslint/prefer-standalone': 'error',
      '@angular-eslint/no-output-on-prefix': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/array-type': 'off',
      // No-op ControlValueAccessor callbacks (`onChange = () => {}`) are intentional.
      '@typescript-eslint/no-empty-function': ['error', { allow: ['arrowFunctions'] }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
    },
  },
  {
    files: ['src/app/core/**/*.ts'],
    rules: boundary(
      ['@shared/*', '@layout/*', '@features/*'],
      'core is the foundation layer — it must not depend on shared, layout or features.',
    ),
  },
  {
    files: ['src/app/shared/**/*.ts'],
    rules: boundary(
      ['@layout/*', '@features/*'],
      'shared UI must stay feature-agnostic — no layout/feature imports.',
    ),
  },
  {
    files: ['src/app/layout/**/*.ts'],
    rules: boundary(['@features/*'], 'layout must not depend on a specific feature.'),
  },
  {
    files: ['src/app/features/**/*.ts'],
    rules: boundary(
      ['@features/*', '@layout/*'],
      'Features are isolated: never import another feature (move shared code to core/ or shared/), and use relative imports inside your own feature.',
    ),
  },
  {
    files: ['**/*.spec.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off', 'no-restricted-imports': 'off' },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {},
  },
);
