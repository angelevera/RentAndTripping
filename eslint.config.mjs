import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Server Actions bound with curried leading args (e.g.
      // reenviarInvitacionAction(userId, email, nombre, _previo, _formData))
      // must still accept useActionState's trailing (prevState, formData)
      // pair even when the body doesn't need them — underscore-prefixed
      // trailing args signal that intentionally, same convention already
      // used for leading unused args like crearReserva's `_previo`.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
