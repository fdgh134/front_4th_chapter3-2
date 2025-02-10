module.exports = {
  root: true,
  plugins: ['react', 'react-hooks', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:react-hooks/recommended',
    'plugin:storybook/recommended',
    'plugin:prettier/recommended',
    'plugin:cypress/recommended',
    'plugin:import/warnings',
  ],
  env: {
    browser: true,
    node: true,
  },
  ignorePatterns: ['node_modules/*', 'dist'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    tsconfigRootDir: __dirname,
    ecmaVersion: 2022,
  },
  rules: {
    'no-unused-vars': 'warn',
    'react/prop-types': 'off',
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', ['parent', 'sibling'], 'index'],
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
        'newlines-between': 'always',
      },
    ],
    'jsx-a11y/no-access-key': 'off',
    'jsx-a11y/aria-props': 'off',
    'jsx-a11y/aria-proptypes': 'off',
    'jsx-a11y/aria-unsupported-elements': 'off',
    'jsx-a11y/role-has-required-aria-props': 'off',
    'jsx-a11y/role-supports-aria-props': 'off',
  },
  globals: {
    Set: true,
    Map: true,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  overrides: [
    {
      files: [
        '**/src/**/*.{spec,test}.[jt]s?(x)',
        '**/__mocks__/**/*.[jt]s?(x)',
        './src/setupTests.ts',
      ],
      plugins: ['vitest'],
      extends: ['plugin:vitest/recommended'],
      rules: {
        'vitest/expect-expect': 'off',
      },
      globals: {
        globalThis: true,
        describe: true,
        it: true,
        expect: true,
        beforeEach: true,
        afterEach: true,
        beforeAll: true,
        afterAll: true,
        vi: true,
      },
    },
    {
      files: ['cypress/e2e/**/*.cy.js'],
      plugins: ['cypress'],
      extends: ['plugin:cypress/recommended'],
      env: {
        'cypress/globals': true,
      },
      globals: {
        cy: true,
      },
    },
  ],
};
