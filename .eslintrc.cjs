module.exports = {
  root: true,
  env: {
    es2023: true,
    node: true,
  },
  extends: ["standard"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    ecmaFeatures: {
      jsx: true,
    },
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  ignorePatterns: [
    "**/.expo/**",
    "**/coverage/**",
    "**/dist/**",
    "**/node_modules/**",
    "**/src-tauri/gen/**",
    "**/src-tauri/target/**",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],
    "no-undef": "off",
    "no-unused-vars": "off",
    quotes: ["error", "double", { avoidEscape: true }],
    semi: ["error", "always"],
  },
  overrides: [
    {
      files: ["client/**/*.{js,jsx,ts,tsx}"],
      env: {
        browser: true,
        node: false,
      },
    },
    {
      files: ["client/src-tauri/**/*.js", "client/scripts/**/*.js"],
      env: {
        browser: false,
        node: true,
      },
    },
  ],
};