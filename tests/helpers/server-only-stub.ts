// Vitest runs outside Next.js's bundler, which is the only place "server-only"
// can distinguish a server bundle from a client one — imported directly via
// Node, the real package throws unconditionally (see node_modules/server-only).
// vitest.config.ts aliases "server-only" to this empty stub so db-project
// tests can import server-only-guarded modules (lib/supabase/admin.ts,
// lib/clientes/invitar.ts) directly, the same way tests/rls/lista-reservas.test.ts
// already imports lib/reservas/listar.ts. The real Next.js build is
// unaffected — it still resolves the real package and still throws if a
// Client Component ever imports one of these files.
export {};
