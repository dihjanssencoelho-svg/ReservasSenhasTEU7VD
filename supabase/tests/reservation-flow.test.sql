-- TEU7VD: testes transacionais de integração.
-- EXECUTAR SOMENTE em Supabase local descartável após aplicar todas as migrações:
--   supabase start
--   supabase db reset
--   psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/reservation-flow.test.sql
-- Este arquivo abre transação e termina com ROLLBACK; não execute contra produção.
begin;

do $test$
declare
  gira_a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  gira_b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
  r1 jsonb; r2 jsonb; rb jsonb;
  rid1 uuid; rid2 uuid; ridb uuid;
  got bigint; audit_count bigint;
begin
  insert into public.giras(id,titulo,data_gira,chave,limite_vagas,ativa,status,tipo_gira)
  values
    (gira_a,'Gira teste A',current_date + 30,'__teste_reserva_a',2,true,'publicada','__teste_tipo_a'),
    (gira_b,'Gira teste B',current_date + 31,'__teste_reserva_b',3,true,'publicada','__teste_tipo_b');

  r1 := public.teu7vd_criar_reserva(gira_a,'Pessoa Teste Um','1990-01-01','11987654321','teste1@example.invalid','Sim',false,null,null,null,null);
  rid1 := (r1->>'reservation_id')::uuid;
  if r1->>'success' <> 'true' then raise exception 'Falha: primeira reserva não retornou sucesso'; end if;

  begin
    perform public.teu7vd_criar_reserva(gira_a,'  pessoa   teste um ','1990-01-01','11987654321','teste1@example.invalid','Sim',false,null,null,null,null);
    raise exception 'Falha: duplicidade foi aceita';
  exception when unique_violation then null;
  end;

  r2 := public.teu7vd_criar_reserva(gira_a,'Pessoa Teste Dois','1991-02-02','11987654322','teste2@example.invalid','Não',false,null,null,null,null);
  rid2 := (r2->>'reservation_id')::uuid;

  begin
    perform public.teu7vd_criar_reserva(gira_a,'Pessoa Teste Tres','1992-03-03','11987654323','teste3@example.invalid','Não',false,null,null,null,null);
    raise exception 'Falha: reserva acima da capacidade foi aceita';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%limite de vagas%' then raise; end if;
  end;

  rb := public.teu7vd_criar_reserva(gira_b,'Pessoa Teste Quatro','1993-04-04','11987654324','teste4@example.invalid','Não',false,null,null,null,null);
  ridb := (rb->>'reservation_id')::uuid;

  select senha_numero into got from public.reservas where id=rid1;
  if got <> 1 then raise exception 'Falha: primeira senha do tipo A esperada 1, obtida %', got; end if;
  select senha_numero into got from public.reservas where id=rid2;
  if got <> 2 then raise exception 'Falha: segunda senha do tipo A esperada 2, obtida %', got; end if;
  select senha_numero into got from public.reservas where id=ridb;
  if got <> 1 then raise exception 'Falha: primeira senha do tipo B esperada 1, obtida %', got; end if;

  select count(*) into got from public.reservas where gira_id=gira_a and status='ativa';
  if got <> 2 then raise exception 'Falha: capacidade deveria manter exatamente 2 reservas, obtido %', got; end if;

  select count(*) into audit_count from public.auditoria
    where acao='reserva_criada' and entidade='reserva'
      and entidade_id in (rid1::text,rid2::text,ridb::text);
  if audit_count <> 3 then raise exception 'Falha: esperados 3 registros de auditoria de criação, obtidos %', audit_count; end if;

  raise notice 'PASSOU: criação, duplicidade, capacidade, numeração por tipo e auditoria';
end
$test$;

rollback;
