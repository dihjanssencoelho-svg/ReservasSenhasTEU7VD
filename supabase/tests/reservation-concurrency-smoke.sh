#!/usr/bin/env bash
set -euo pipefail

# Somente Supabase local descartável. A guarda impede executar acidentalmente
# contra uma URL remota; este script nunca usa credenciais de produção.
: "${LOCAL_DATABASE_URL:?Defina LOCAL_DATABASE_URL para o Supabase local}"
case "$LOCAL_DATABASE_URL" in
  *127.0.0.1:54322*|*localhost:54322*) ;;
  *) echo "ERRO: use apenas o banco Supabase local na porta 54322." >&2; exit 2 ;;
esac

GIRA_A="cccccccc-cccc-4ccc-8ccc-ccccccccccc3"
GIRA_B="dddddddd-dddd-4ddd-8ddd-ddddddddddd4"
GIRA_C="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5"
TIPO_CAP="__concorrencia_capacidade_teu7vd"
TIPO_NUM="__concorrencia_numero_teu7vd"
TMP="$(mktemp -d)"
cleanup() {
  psql "$LOCAL_DATABASE_URL" -X -v ON_ERROR_STOP=1 -q \
    -v gira_a="$GIRA_A" -v gira_b="$GIRA_B" -v gira_c="$GIRA_C" \
    -v tipo_cap="$TIPO_CAP" -v tipo_num="$TIPO_NUM" <<'SQL' || true
delete from public.auditoria where entidade_id in (
  select id::text from public.reservas where gira_id in (:'gira_a',:'gira_b',:'gira_c')
);
delete from public.reservas where gira_id in (:'gira_a',:'gira_b',:'gira_c');
delete from public.contadores_senha where tipo_gira in (:'tipo_cap',:'tipo_num');
delete from public.giras where id in (:'gira_a',:'gira_b',:'gira_c');
SQL
  rm -rf "$TMP"
}
trap cleanup EXIT

psql "$LOCAL_DATABASE_URL" -X -v ON_ERROR_STOP=1 -q \
  -v gira_a="$GIRA_A" -v gira_b="$GIRA_B" -v gira_c="$GIRA_C" \
  -v tipo_cap="$TIPO_CAP" -v tipo_num="$TIPO_NUM" <<'SQL'
delete from public.auditoria where entidade_id in (
  select id::text from public.reservas where gira_id in (:'gira_a',:'gira_b',:'gira_c')
);
delete from public.reservas where gira_id in (:'gira_a',:'gira_b',:'gira_c');
delete from public.contadores_senha where tipo_gira in (:'tipo_cap',:'tipo_num');
delete from public.giras where id in (:'gira_a',:'gira_b',:'gira_c');
insert into public.giras(id,titulo,data_gira,chave,limite_vagas,ativa,status,tipo_gira)
values
  (:'gira_a','Teste concorrente capacidade',current_date + 40,'__teste_conc_cap',1,true,'publicada',:'tipo_cap'),
  (:'gira_b','Teste concorrente numeração A',current_date + 41,'__teste_conc_num_a',2,true,'publicada',:'tipo_num'),
  (:'gira_c','Teste concorrente numeração B',current_date + 42,'__teste_conc_num_b',2,true,'publicada',:'tipo_num');
SQL

worker() {
  local gira="$1" n="$2" tipo="$3" phase="$4"
  if psql "$LOCAL_DATABASE_URL" -X -v ON_ERROR_STOP=1 -qAt \
      -v gira_id="$gira" -v n="$n" -v tipo="$tipo" \
      >"$TMP/out-$phase-$n" 2>"$TMP/err-$phase-$n" <<'SQL'
select public.teu7vd_criar_reserva(
  :'gira_id'::uuid,
  'Concorrente ' || :'tipo' || ' ' || :'n',
  ('1990-01-0' || :'n')::date,
  '1198765432' || :'n',
  'concorrente-' || :'tipo' || '-' || :'n' || '@example.invalid',
  'Não', false, null, null, null, null
);
SQL
  then
    echo success >"$TMP/status-$phase-$n"
  else
    echo rejected >"$TMP/status-$phase-$n"
  fi
}

# Cenário 1: mesma gira com uma vaga, duas requisições simultâneas.
worker "$GIRA_A" 1 "$TIPO_CAP" cap &
pid1=$!
worker "$GIRA_A" 2 "$TIPO_CAP" cap &
pid2=$!
wait "$pid1"; wait "$pid2"

SUCCESS="$(grep -l '^success$' "$TMP"/status-cap-* 2>/dev/null | wc -l | tr -d ' ')"
REJECTED="$(grep -l '^rejected$' "$TMP"/status-cap-* 2>/dev/null | wc -l | tr -d ' ')"
if [ "$SUCCESS" -ne 1 ] || [ "$REJECTED" -ne 1 ]; then
  echo "FALHA: capacidade esperava 1 sucesso/1 rejeição; obtido $SUCCESS/$REJECTED." >&2
  cat "$TMP"/err-cap-* >&2 || true
  exit 1
fi

# Cenário 2: duas giras distintas, mesmo tipo e capacidade disponível.
# Ambas devem ser aceitas e receber números diferentes, consecutivos.
worker "$GIRA_B" 3 "$TIPO_NUM" num &
pid3=$!
# A segunda chamada usa outra gira, mas compartilha o mesmo contador de tipo.
worker "$GIRA_C" 4 "$TIPO_NUM" num &
pid4=$!
wait "$pid3"; wait "$pid4"

SUCCESS="$(grep -l '^success$' "$TMP"/status-num-* 2>/dev/null | wc -l | tr -d ' ')"
REJECTED="$(grep -l '^rejected$' "$TMP"/status-num-* 2>/dev/null | wc -l | tr -d ' ')"
if [ "$SUCCESS" -ne 2 ] || [ "$REJECTED" -ne 0 ]; then
  echo "FALHA: numeração concorrente esperava 2 sucessos; obtido $SUCCESS sucessos/$REJECTED rejeições." >&2
  cat "$TMP"/err-num-* >&2 || true
  exit 1
fi

psql "$LOCAL_DATABASE_URL" -X -v ON_ERROR_STOP=1 -q \
  -v gira_a="$GIRA_A" -v gira_b="$GIRA_B" -v gira_c="$GIRA_C" \
  -v tipo_cap="$TIPO_CAP" -v tipo_num="$TIPO_NUM" <<'SQL'
do $check$
declare v_count bigint; v_counter bigint; v_audit bigint; v_min bigint; v_max bigint;
begin
  select count(*) into v_count from public.reservas where gira_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc3' and status='ativa';
  if v_count <> 1 then raise exception 'Falha capacidade: esperada 1 reserva ativa, obtidas %',v_count; end if;
  select proxima_senha into v_counter from public.contadores_senha where tipo_gira='__concorrencia_capacidade_teu7vd';
  if v_counter <> 2 then raise exception 'Falha capacidade: contador deveria avançar uma vez, obtido %',v_counter; end if;
  select count(*) into v_audit from public.auditoria a join public.reservas r on a.entidade_id=r.id::text
    where r.gira_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc3' and a.acao='reserva_criada';
  if v_audit <> 1 then raise exception 'Falha capacidade: esperada 1 auditoria, obtidas %',v_audit; end if;

  select count(*),min(senha_numero),max(senha_numero) into v_count,v_min,v_max
    from public.reservas where gira_id in ('dddddddd-dddd-4ddd-8ddd-ddddddddddd4','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5') and status='ativa';
  if v_count <> 2 then raise exception 'Falha numeração: esperadas 2 reservas, obtidas %',v_count; end if;
  if v_min <> 1 or v_max <> 2 then raise exception 'Falha numeração: esperadas senhas consecutivas 1 e 2, obtidas % e %',v_min,v_max; end if;
  if (select count(distinct senha_numero) from public.reservas where gira_id in ('dddddddd-dddd-4ddd-8ddd-ddddddddddd4','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5')) <> 2 then
    raise exception 'Falha numeração: senha duplicada em chamadas concorrentes';
  end if;
  select proxima_senha into v_counter from public.contadores_senha where tipo_gira='__concorrencia_numero_teu7vd';
  if v_counter <> 3 then raise exception 'Falha numeração: contador esperado 3 após duas reservas, obtido %',v_counter; end if;
  select count(*) into v_audit from public.auditoria a join public.reservas r on a.entidade_id=r.id::text
    where r.gira_id in ('dddddddd-dddd-4ddd-8ddd-ddddddddddd4','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5') and a.acao='reserva_criada';
  if v_audit <> 2 then raise exception 'Falha numeração: esperadas 2 auditorias, obtidas %',v_audit; end if;
  raise notice 'PASSOU: concorrência de capacidade e atribuição de senhas consecutivas únicas';
end;
$check$;
SQL

echo "PASSOU: concorrência de capacidade, numeração atômica e auditoria."
