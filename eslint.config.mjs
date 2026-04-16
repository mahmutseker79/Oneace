import nextConfig from "eslint-config-next";
import tseslint from "typescript-eslint";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  ...nextConfig,

  // Project-specific overrides — must include the TS plugin reference
  {
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      // Prisma models use any extensively in generated types
      "@typescript-eslint/no-explicit-any": "warn",

      // Many server actions / API routes have unused params for type signatures
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Allow empty interfaces for component prop stubs
      "@typescript-eslint/no-empty-object-type": "off",

      // Allow require() in config files and scripts
      "@typescript-eslint/no-require-imports": "off",

      // Prefer const but don't error on let
      "prefer-const": "warn",

      // Next.js specific
      "@next/next/no-img-element": "warn",

      // Allow console in server code (logger wraps it)
      "no-console": "off",
    },
  },

  // Ignore patterns
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "e2e/**",
      "scripts/**",
      "src/generated/**",
    ],
  },
];

export default config;
