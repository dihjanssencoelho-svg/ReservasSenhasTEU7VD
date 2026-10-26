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
  local name="$1" endpoint="$2" token="$3" origin="$4" payload="$5" expected="$6" method="${7:-POST}"
  local status
  local -a headers
  headers=(-H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H 'Content-Type: application/json')
  if [[ -n "$origin" ]]; then headers+=(-H "Origin: $origin"); fi
  if [[ -n "$token" ]]; then headers+=(-H "Authorization: Bearer $token"); fi
  status="$(curl -sS -o "$TMP/$name.json" -w '%{http_code}' "$BASE/$endpoint" \
    -X "$method" "${headers[@]}" --data "$payload")"
  if [[ "$status" != "$expected" ]]; then
    echo "FALHOU $name: esperado HTTP $expected, recebido $status"
    cat "$TMP/$name.json"
    exit 1
  fi
  echo "OK $name: HTTP $status"
}

# Controles de protocolo/origem e payload; todos param antes do Turnstile/RPC.
request "criar-metodo-negado" "criar-reserva" "" "$TEU7VD_ALLOWED_ORIGIN" '{}' 405 GET
request "criar-sem-origem" "criar-reserva" "" "" '{}' 403
request "criar-origem-negada" "criar-reserva" "" "https://origem-nao-autorizada.invalid" '{}' 403
request "criar-json-malformado" "criar-reserva" "" "$TEU7VD_ALLOWED_ORIGIN" '{' 400
request "criar-campo-extra" "criar-reserva" "" "$TEU7VD_ALLOWED_ORIGIN" '{"campo_desconhecido":true}' 400
request "criar-payload-incompleto" "criar-reserva" "" "$TEU7VD_ALLOWED_ORIGIN" '{}' 400
# Payload sintaticamente válido com token Turnstile deliberadamente inválido.
# Deve ser recusado pelo siteverify antes da chamada à RPC e sem mutações.
request "criar-turnstile-invalido" "criar-reserva" "" "$TEU7VD_ALLOWED_ORIGIN" '{"gira_id":"00000000-0000-4000-8000-000000000001","nome_completo":"Teste Homologacao","data_nascimento":"1990-01-01","telefone":"11999999999","email":"homologacao@example.invalid","primeira_vez":"Não","preferencial":false,"turnstile_token":"invalid-test-token-not-real"}' 403

# Sem bearer token, endpoints protegidos devem parar antes de consultar dados.
request "listar-sem-token" "listar-reservas" "" "$TEU7VD_ALLOWED_ORIGIN" '{}' 401
request "listar-origem-negada" "listar-reservas" "" "https://origem-nao-autorizada.invalid" '{}' 403
request "admin-sem-token" "admin-reservas" "" "$TEU7VD_ALLOWED_ORIGIN" '{}' 401
request "admin-token-invalido" "admin-reservas" "invalid.jwt.token" "$TEU7VD_ALLOWED_ORIGIN" '{"action":"cancel","reservation_id":"00000000-0000-4000-8000-000000000001"}' 401
request "admin-origem-negada" "admin-reservas" "" "https://origem-nao-autorizada.invalid" '{}' 403

echo "Concluído: smoke tests HTTP não mutáveis passaram."
echo "Use apenas em ambiente de homologação com funções já implantadas."
