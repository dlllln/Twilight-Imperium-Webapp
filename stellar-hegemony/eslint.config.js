// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const forbid = (...packages) => ({
  patterns: packages.map((name) => ({
    group: [name, `${name}/*`],
    message: 'Abhängigkeiten zeigen nur nach innen (Clean Architecture).',
  })),
});

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/coverage/**', '**/dist/**'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'max-depth': ['error', 2],
      complexity: ['error', 8],
      'no-else-return': 'error',
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
    },
  },
  {
    files: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
    rules: {
      'max-lines-per-function': ['error', { max: 20, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // React-Komponenten: JSX-Markup zählt mit, daher etwas mehr Raum als für Logik.
    files: ['apps/*/src/**/*.tsx'],
    rules: {
      'max-lines-per-function': ['error', { max: 30, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['packages/domain/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        forbid('@stellar/application', '@stellar/infrastructure', '@stellar/content', 'node:*'),
      ],
      '@typescript-eslint/no-magic-numbers': [
        'error',
        {
          ignore: [0, 1, -1],
          ignoreEnums: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
        },
      ],
      'no-throw-literal': 'error',
      'no-restricted-syntax': [
        'error',
        { selector: 'ThrowStatement', message: 'Die Domain meldet Fehler als Result<T, E>.' },
      ],
    },
  },
  {
    files: ['packages/application/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', forbid('@stellar/infrastructure')],
    },
  },
  {
    files: ['packages/content/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', forbid('@stellar/application', '@stellar/infrastructure')],
    },
  },
  {
    files: ['packages/bots/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        forbid('@stellar/application', '@stellar/infrastructure', '@stellar/content'),
      ],
    },
  },
  {
    files: ['**/*.js', '**/*.config.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
);
