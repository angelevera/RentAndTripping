#!/usr/bin/env bash
# Checks that the Phase 1 Supabase/admin env vars are present and non-empty,
# without ever printing their values. Prints exactly "OK: <name>" or
# "FALTA: <name> (en <file>)" per variable, one per line.
set -u
cd "$(dirname "$0")/.."

VARS=(
  "NEXT_PUBLIC_SUPABASE_URL:.env.local"
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:.env.local"
  "SUPABASE_SECRET_KEY:.env.local"
  "SUPABASE_SECRET_KEY:.env.admin.local"
  "SUPABASE_PROJECT_REF:.env.admin.local"
  "SUPABASE_DB_PASSWORD:.env.admin.local"
  "SUPABASE_ACCESS_TOKEN:.env.admin.local"
  "ADMIN_INITIAL_PASSWORD:.env.admin.local"
)

status=0
for entry in "${VARS[@]}"; do
  name="${entry%%:*}"
  file="${entry##*:}"
  val=""
  if [ -f "$file" ]; then
    val=$(grep "^${name}=" "$file" 2>/dev/null | head -1 | cut -d= -f2-)
  fi
  if [ -z "$val" ]; then
    echo "FALTA: ${name} (en ${file})"
    status=1
  else
    echo "OK: ${name}"
  fi
done

exit $status
