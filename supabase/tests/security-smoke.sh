#!/usr/bin/env bash
# TEU7VD — smoke tests de segurança para a Edge Function listar-reservas.
# Somente leitura. Não cria, altera nem cancela reservas.
set -euo pipefail

: "${SUPABASE_URL:?Defina SUPABASE_URL}"
: "${SUPABASE_PUBLISHABLE_KEY:?Defina SUPABASE_PUBLISHABLE_KEY}"
: "${TEU7VD_ALLOWED_ORIGIN:?Defina TEU7VD_ALLOWED_ORIGIN}"
: "${TOKEN_ADMIN:?Defina JWT de usuário de teste com papel admin}"

BASE="${SUPABASE_URL%/}/functions/v1/listar-reservas"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

request() {
  local name="$1" token="$2" origin="$3" payload="$4" expected="$5"
  local status
  status="$(curl -sS -o "$TMP/$name.json" -w '%{http_code}' "$BASE" \
    -X POST \
    -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
    -H "Authorization: Bearer $token" \
    -H "Origin: $origin" \
    -H 'Content-Type: application/json' \
    --data "$payload")"
  if [[ "$status" != "$expected" ]]; then
    echo "FALHOU $name: esperado HTTP $expected, recebido $status"
    cat "$TMP/$name.json"
    exit 1
  fi
  echo "OK $name: HTTP $status"
}

request "sem-token" "" "$TEU7VD_ALLOWED_ORIGIN" '{}' 401
request "token-invalido" "invalid.jwt.token" "$TEU7VD_ALLOWED_ORIGIN" '{}' 401
request "origem-negada" "$TOKEN_ADMIN" "https://origem-nao-autorizada.invalid" '{}' 403
request "campo-extra" "$TOKEN_ADMIN" "$TEU7VD_ALLOWED_ORIGIN" '{"is_admin":true}' 400
request "paginacao-invalida" "$TOKEN_ADMIN" "$TEU7VD_ALLOWED_ORIGIN" '{"page":0}' 400
request "data-impossivel" "$TOKEN_ADMIN" "$TEU7VD_ALLOWED_ORIGIN" '{"data_inicio":"2026-02-30"}' 400
request "admin-listagem" "$TOKEN_ADMIN" "$TEU7VD_ALLOWED_ORIGIN" '{"page":1,"page_size":10}' 200

echo "ATENÇÃO: use somente token de admin autorizado. Não execute ações de mutação neste script."
