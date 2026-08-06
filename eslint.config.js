import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

const typeChecked = tseslint.configs.strictTypeChecked.map((config) => ({
  ...config,
  files: ["**/*.ts"],
}));

const stylistic = tseslint.configs.stylisticTypeChecked.map((config) => ({
  ...config,
  files: ["**/*.ts"],
}));

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      ".artifacts/**",
      "examples/**",
      "test/fixtures/**/build/**",
    ],
  },
  {
    languageOptions: {
      globals: globals.node,
    },
  },
  js.configs.recommended,
  ...typeChecked,
  ...stylistic,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["examples/minimal/ahk-build.config.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true, allowBoolean: true, allowNullish: false },
      ],
    },
  },
  prettier,
);
