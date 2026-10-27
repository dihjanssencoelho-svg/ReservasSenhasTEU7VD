-- TEU7VD: fluxo positivo das RPCs administrativas v2 em banco local descartável.
-- Fixtures e mutações ficam dentro de transação com ROLLBACK; nunca executar em produção.
begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd4',
  'authenticated', 'authenticated', 'admin-homologacao@example.invalid',
  '', now(), '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Admin Homologação"}'::jsonb, now(), now()
);

insert into public.perfis_admin(user_id,nome,papel,ativo)
values ('dddddddd-dddd-4ddd-8ddd-ddddddddddd4','Admin de teste','admin',true);

insert into public.giras(id,titulo,data_gira,chave,limite_vagas,ativa,status,tipo_gira)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5','Gira administrativa de teste',
        current_date + 40,'__teste_admin_rpc',2,true,'publicada','__teste_admin_tipo');

do $admin_flow$
declare
  v_result jsonb;
  v_reserva uuid;
  v_count integer;
  v_status text;
  v_actor uuid := 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4';
begin
  -- RPC de criação só pode ser chamada pelo papel confiável no teste.
  execute 'set local role service_role';
  v_result := public.teu7vd_criar_reserva(
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5',
    'Pessoa Admin Teste','1990-05-06','11999990000',
    'pessoa-admin@example.invalid','Sim',false,null,null,null,null
  );
  execute 'reset role';
  v_reserva := (v_result->>'reservation_id')::uuid;
  if v_result->>'success' <> 'true' or v_reserva is null then
    raise exception 'Falha: criação da reserva de teste';
  end if;

  execute 'set local role service_role';
  if public.teu7vd_cancelar_reserva_v2(v_reserva,'teste de homologação',v_actor) is not true then
    raise exception 'Falha: RPC de cancelamento não confirmou sucesso';
  end if;
  execute 'reset role';
  select status into v_status from public.reservas where id=v_reserva;
  if v_status <> 'cancelada' then raise exception 'Falha: status após cancelamento: %',v_status; end if;

  execute 'set local role service_role';
  if public.teu7vd_reabrir_reserva_v2(v_reserva,'reabertura de homologação',v_actor) is not true then
    raise exception 'Falha: RPC de reabertura não confirmou sucesso';
  end if;
  execute 'reset role';
  select status into v_status from public.reservas where id=v_reserva;
  if v_status <> 'ativa' then raise exception 'Falha: status após reabertura: %',v_status; end if;

  execute 'set local role service_role';
  if public.teu7vd_excluir_reserva_v2(v_reserva,'exclusão de homologação',v_actor) is not true then
    raise exception 'Falha: RPC de exclusão não confirmou sucesso';
  end if;
  execute 'reset role';
  select status into v_status from public.reservas where id=v_reserva;
  if v_status <> 'excluida' then raise exception 'Falha: status após exclusão: %',v_status; end if;

  select count(*) into v_count from public.auditoria
  where entidade='reserva' and entidade_id=v_reserva::text
    and user_id=v_actor
    and acao in ('reserva_cancelada','reserva_reaberta','reserva_excluida');
  if v_count <> 3 then raise exception 'Falha: esperadas 3 auditorias administrativas, obtidas %',v_count; end if;

  raise notice 'PASSOU: fluxo admin positivo — cancelar, reabrir, excluir e auditar';
end;
$admin_flow$;

rollback;
