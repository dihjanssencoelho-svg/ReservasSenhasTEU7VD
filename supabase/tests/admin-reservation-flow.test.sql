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
        current_date + 40,'__teste_admin_rpc',1,true,'publicada','__teste_admin_tipo');

do $admin_flow$
declare
  v_result jsonb;
  v_import jsonb;
  v_import_id uuid;
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

  -- Excedente permitido somente pela RPC administrativa, com motivo e auditoria.
  execute 'set local role service_role';
  v_result := public.teu7vd_criar_reserva_admin(
    v_actor,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5',
    'Pessoa Excedente Teste','1992-07-08','11999990009',
    'pessoa-excedente@example.invalid','Não',false,null,null,null,null,
    'Autorização administrativa de homologação'
  );
  execute 'reset role';
  if v_result->>'success' <> 'true' then raise exception 'Falha: excedente administrativo não foi aceito'; end if;
  if not exists(select 1 from public.reservas where id=(v_result->>'reservation_id')::uuid and origem='painel_admin_excedente') then
    raise exception 'Falha: excedente não foi identificado como cadastro administrativo';
  end if;
  if not exists(select 1 from public.auditoria where acao='reserva_criada_excedente' and entidade_id=v_result->>'reservation_id'
    and user_id=v_actor and detalhes->>'motivo'='Autorização administrativa de homologação') then
    raise exception 'Falha: excedente não gerou auditoria com ator e motivo';
  end if;

  -- Importação histórica: prévia não insere reservas; aplicação é atômica e auditada.
  v_import := public.teu7vd_preparar_importacao_reservas(v_actor,
    jsonb_build_array(jsonb_build_object(
      'gira_id','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5',
      'senha_original','LEGADO-TESTE-01','nome_completo','Pessoa Legada Teste',
      'data_nascimento','1988-08-09','telefone','11999990007',
      'email','legado@example.invalid','primeira_vez','Não','preferencial',false,
      'status','cancelada','linha_origem','2'
    )));
  v_import_id := (v_import->>'job_id')::uuid;
  if v_import->>'success'<>'true' then raise exception 'Falha: prévia de importação não validada'; end if;
  if exists(select 1 from public.reservas where email='legado@example.invalid') then
    raise exception 'Falha: prévia de importação alterou reservas antes da aplicação';
  end if;
  execute 'set local role service_role';
  v_import := public.teu7vd_aplicar_importacao_reservas(v_actor,v_import_id,'Importação de fixture para homologação');
  execute 'reset role';
  if v_import->>'success'<>'true' or not exists(select 1 from public.reservas where email='legado@example.invalid' and status='cancelada' and legado_importado=true and senha_original='LEGADO-TESTE-01') then
    raise exception 'Falha: importação histórica não preservou senha/status';
  end if;
  if not exists(select 1 from public.auditoria where acao='importacao_reservas_aplicada' and entidade_id=v_import_id::text and user_id=v_actor) then
    raise exception 'Falha: importação não foi auditada';
  end if;

  -- Configurações só podem ser atualizadas por admin ativo e geram auditoria.
  execute 'set local role service_role';
  if public.teu7vd_atualizar_configuracoes_portal('Mensagem pública de teste','Confirmação de teste','#17131e','#c9a86a',3,v_actor) is not true then
    raise exception 'Falha: atualização das configurações não confirmou sucesso';
  end if;
  execute 'reset role';
  if not exists(select 1 from public.auditoria where acao='configuracoes_portal_atualizadas' and user_id=v_actor) then
    raise exception 'Falha: configuração não gerou auditoria';
  end if;

  begin
    perform public.teu7vd_criar_reserva_admin(
      'ffffffff-ffff-4fff-8fff-fffffffffff6','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5',
      'Pessoa Sem Perfil','1992-07-09','11999990008',
      'sem-perfil@example.invalid','Não',false,null,null,null,null,'Tentativa não autorizada'
    );
    raise exception 'Falha: excedente aceito sem perfil administrativo';
  exception when sqlstate '42501' then null;
  end;

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
