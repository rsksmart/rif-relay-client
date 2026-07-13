module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier",
  ],
  env: {
    browser: false,
    es2021: true,
    mocha: true,
    node: true,
  },
  plugins: ["@typescript-eslint", "mocha"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    tsconfigRootDir: __dirname,
    project: "./tsconfig.json",
  },
  overrides: [
    {
      // TODO(refactor): Fix bignumber.js imports (export= module) in src/api/pricer and
      // src/pricer so BigNumber is typed correctly; then remove this override.
      // See docs/DEPENDENCY-REMEDIATION.md Option B.
      files: ['src/api/pricer/**', 'src/pricer/**'],
      rules: {
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
      },
    },
    {
      extends: [
        "plugin:mocha/recommended",
        "plugin:jest-formatting/strict", // easiest way to add padding around tests blocks rules. could write our own in future using [padding-line-between-statements](https://eslint.org/docs/latest/rules/padding-line-between-statements) rule
      ],
      // TODO(refactor): Same bignumber.js typing fix as src/api/pricer; then re-enable no-unsafe-* here.
      files: ['test/**'],
      plugins: ['mocha'],
      rules: {
        // you should turn the original rule off *only* for test files
        '@typescript-eslint/unbound-method': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
      },
    },
  ],
  rules: {
    "lines-between-class-members": "error",
    "padding-line-between-statements": [
      "error",
      { blankLine: "always", prev: "*", next: "return" },
    ],
    "prefer-const": [
      "error",
      {
        destructuring: "any",
        ignoreReadBeforeAssign: false,
      },
    ],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/naming-convention": [
      "error",
      {
        selector: ["variable", "function"],
        format: ["camelCase"],
      },
      {
        selector: ["variable"],
        modifiers: ["const"],
        format: ["camelCase", "UPPER_CASE"],
      },
    ],
    "mocha/no-skipped-tests": "warn",
    "mocha/no-empty-description": "off",
    "mocha/no-exclusive-tests": "error",
    "@typescript-eslint/no-unsafe-member-access": "warn"
  },
};
