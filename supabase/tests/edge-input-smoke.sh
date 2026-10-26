#!/usr/bin/env bash
# TEU7VD — smoke tests HTTP sem mutações.
# Todos os casos são interrompidos na validação de origem/autenticação/payload;
# não usam token Turnstile válido e não devem criar nem alterar registros.
set -euo pipefail

: "${SUPABASE_URL:?Defina SUPABASE_URL}"
: "${SUPABASE_PUBLISHABLE_KEY:?Defina SUPABASE_PUBLISHABLE_KEY}"
: "${TEU7VD_ALLOWED_ORIGIN:?Defina TEU7VD_ALLOWED_ORIGIN}"

BASE="${SUPABASE_URL%/}/functions/v1"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

request() {
  local name="$1" endpoint="$2" token="$3" origin="$4" payload="$5" expected="$6"
  local status
  local -a headers
  headers=(-H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H "Origin: $origin" -H 'Content-Type: application/json')
  if [[ -n "$token" ]]; then headers+=(-H "Authorization: Bearer $token"); fi
  status="$(curl -sS -o "$TMP/$name.json" -w '%{http_code}' "$BASE/$endpoint" \
    -X POST "${headers[@]}" --data "$payload")"
  if [[ "$status" != "$expected" ]]; then
    echo "FALHOU $name: esperado HTTP $expected, recebido $status"
    cat "$TMP/$name.json"
    exit 1
  fi
  echo "OK $name: HTTP $status"
}

# Payload incompleto deve ser recusado antes de Turnstile ou qualquer RPC.
request "criar-payload-incompleto" "criar-reserva" "" "$TEU7VD_ALLOWED_ORIGIN" '{}' 400
request "criar-origem-negada" "criar-reserva" "" "https://origem-nao-autorizada.invalid" '{}' 403

# Sem bearer token, endpoints protegidos devem parar antes de consultar dados.
request "listar-sem-token" "listar-reservas" "" "$TEU7VD_ALLOWED_ORIGIN" '{}' 401
request "listar-origem-negada" "listar-reservas" "" "https://origem-nao-autorizada.invalid" '{}' 403
request "admin-sem-token" "admin-reservas" "" "$TEU7VD_ALLOWED_ORIGIN" '{}' 401
request "admin-origem-negada" "admin-reservas" "" "https://origem-nao-autorizada.invalid" '{}' 403

echo "Concluído: smoke tests HTTP não mutáveis passaram."
echo "Use apenas em ambiente de homologação com funções já implantadas."
