#!/usr/bin/env bash
set -euo pipefail

# Somente Supabase local descartável. A guarda impede executar acidentalmente
# contra uma URL remota; o teste nunca usa secrets nem endpoint de produção.
: "${LOCAL_DATABASE_URL:?Defina LOCAL_DATABASE_URL para o Supabase local}"
case "$LOCAL_DATABASE_URL" in
  *127.0.0.1:54322*|*localhost:54322*) ;;
  *) echo "ERRO: use apenas o banco Supabase local na porta 54322." >&2; exit 2 ;;
esac

GIRA_ID="cccccccc-cccc-4ccc-8ccc-ccccccccccc3"
TIPO="__concorrencia_teu7vd"
TMP="$(mktemp -d)"
cleanup() {
  psql "$LOCAL_DATABASE_URL" -X -v ON_ERROR_STOP=1 -q -v gira_id="$GIRA_ID" -v tipo="$TIPO" <<'SQL' || true
delete from public.auditoria where entidade_id in (select id::text from public.reservas where gira_id = :'gira_id');
delete from public.reservas where gira_id = :'gira_id';
delete from public.contadores_senha where tipo_gira = :'tipo';
delete from public.giras where id = :'gira_id';
SQL
  rm -rf "$TMP"
}
trap cleanup EXIT

psql "$LOCAL_DATABASE_URL" -X -v ON_ERROR_STOP=1 -q -v gira_id="$GIRA_ID" -v tipo="$TIPO" <<'SQL'
delete from public.auditoria where entidade_id in (select id::text from public.reservas where gira_id = :'gira_id');
delete from public.reservas where gira_id = :'gira_id';
delete from public.contadores_senha where tipo_gira = :'tipo';
delete from public.giras where id = :'gira_id';
insert into public.giras(id,titulo,data_gira,chave,limite_vagas,ativa,status,tipo_gira)
values (:'gira_id','Teste concorrente local',current_date + 40,'__teste_concorrente_local',1,true,'publicada',:'tipo');
SQL

worker() {
  local n="$1"
  if psql "$LOCAL_DATABASE_URL" -X -v ON_ERROR_STOP=1 -qAt \
      -v gira_id="$GIRA_ID" -v n="$n" >"$TMP/out$n" 2>"$TMP/err$n" <<'SQL'
select public.teu7vd_criar_reserva(
  :'gira_id'::uuid,
  'Concorrente ' || :'n',
  ('1990-01-0' || :'n')::date,
  '1198765432' || :'n',
  'concorrente' || :'n' || '@example.invalid',
  'Não', false, null, null, null, null
);
SQL
  then
    echo success >"$TMP/status$n"
  else
    echo rejected >"$TMP/status$n"
  fi
}

# Dispare em sessões PostgreSQL separadas, ao mesmo tempo.
worker 1 &
pid1=$!
worker 2 &
pid2=$!
wait "$pid1"
wait "$pid2"

SUCCESS="$(grep -l '^success$' "$TMP"/status* 2>/dev/null | wc -l | tr -d ' ')"
REJECTED="$(grep -l '^rejected$' "$TMP"/status* 2>/dev/null | wc -l | tr -d ' ')"
if [ "$SUCCESS" -ne 1 ] || [ "$REJECTED" -ne 1 ]; then
  echo "FALHA: esperado exatamente 1 sucesso e 1 rejeição; obtido $SUCCESS e $REJECTED." >&2
  cat "$TMP"/err* >&2 || true
  exit 1
fi

psql "$LOCAL_DATABASE_URL" -X -v ON_ERROR_STOP=1 -q -v gira_id="$GIRA_ID" -v tipo="$TIPO" <<'SQL'
do $check$
declare v_count bigint; v_ticket bigint; v_counter bigint; v_audit bigint;
begin
  select count(*) into v_count from public.reservas where gira_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc3' and status='ativa';
  if v_count <> 1 then raise exception 'Falha concorrente: esperada 1 reserva ativa, obtidas %',v_count; end if;
  select min(senha_numero) into v_ticket from public.reservas where gira_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
  if v_ticket <> 1 then raise exception 'Falha concorrente: senha esperada 1, obtida %',v_ticket; end if;
  select proxima_senha into v_counter from public.contadores_senha where tipo_gira='__concorrencia_teu7vd';
  if v_counter <> 2 then raise exception 'Falha concorrente: contador esperado 2 após uma criação, obtido %',v_counter; end if;
  select count(*) into v_audit from public.auditoria a join public.reservas r on a.entidade_id=r.id::text
    where r.gira_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc3' and a.acao='reserva_criada';
  if v_audit <> 1 then raise exception 'Falha concorrente: esperada 1 auditoria, obtidas %',v_audit; end if;
  raise notice 'PASSOU: duas sessões simultâneas, capacidade preservada, senha única e auditoria consistente';
end;
$check$;
SQL

echo "PASSOU: concorrência de capacidade/numeração/auditoria."
