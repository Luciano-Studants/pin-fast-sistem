#!/usr/bin/env bash
# Teste de fumaça de um ambiente publicado.
# Uso: scripts/smoke.sh https://api.seudominio.com https://app.seudominio.com
set -euo pipefail
API="${1:?informe a URL da API}"
APP="${2:-}"
fail() { echo "✗ $1"; exit 1; }
ok() { echo "✓ $1"; }

curl -fsS "$API/health" | grep -q '"status":"ok"' && ok "API /health" || fail "API /health"
curl -fsS "$API/ready"  | grep -q '"ready"'        && ok "API /ready (banco)" || fail "API /ready"

code=$(curl -s -o /dev/null -w '%{http_code}' "$API/api/v1/workspaces")
[ "$code" = "401" ] && ok "rotas privadas exigem login" || fail "esperado 401, veio $code"

code=$(curl -s -o /dev/null -w '%{http_code}' "$API/docs")
[ "$code" = "404" ] && ok "/docs desativado" || echo "! /docs respondeu $code (ENABLE_DOCS ligado?)"

if [ -n "$APP" ]; then
  origin="${APP%/}"
  curl -fsS "$origin/" | grep -qi '<div id="root">' && ok "frontend carrega" || fail "frontend"
  curl -fsS "$origin/qualquer/rota" | grep -qi '<div id="root">' && ok "fallback de SPA" || fail "fallback de SPA"
  hdr=$(curl -sS -o /dev/null -D - "$API/api/v1/workspaces" -H "Origin: $origin" | tr -d "\r")
  echo "$hdr" | grep -qi "access-control-allow-origin: $origin" && ok "CORS libera $origin" || fail "CORS não libera $origin (ajuste CORS_ORIGINS)"
  echo "$hdr" | grep -qi "access-control-allow-credentials: true" && ok "CORS com credenciais" || fail "CORS sem credenciais"
fi
echo "Smoke test concluído."
