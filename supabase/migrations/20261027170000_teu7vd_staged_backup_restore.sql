-- Importação/restauração segura: staging privado e merge transacional, sem apagar registros ausentes do backup.
create table if not exists public.backup_restore_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'validado' check(status in ('validado','aplicado')),
  backup_schema text not null check(backup_schema='teu7vd-backup-v1'),
  payload jsonb not null,
  resumo jsonb not null default '{}'::jsonb,
  criado_por uuid not null references auth.users(id) on delete restrict,
  aplicado_por uuid references auth.users(id) on delete set null,
  motivo_aplicacao text,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
alter table public.backup_restore_jobs enable row level security;
revoke all on public.backup_restore_jobs from anon, authenticated;
grant select on public.backup_restore_jobs to authenticated;
drop policy if exists backup_restore_jobs_admin_select on public.backup_restore_jobs;
create policy backup_restore_jobs_admin_select on public.backup_restore_jobs
for select to authenticated
using(exists(select 1 from public.perfis_admin p where p.user_id=(select auth.uid()) and p.ativo=true and p.papel='admin'));

create or replace function public.teu7vd_preparar_restauracao_backup(p_actor_id uuid,p_backup jsonb)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_giras integer; v_reservas integer; v_contadores integer;
begin
 if p_actor_id is null or not exists(select 1 from public.perfis_admin p where p.user_id=p_actor_id and p.ativo=true and p.papel='admin') then
  raise exception using errcode='42501',message='Apenas administrador ativo pode preparar restauração.';
 end if;
 if jsonb_typeof(p_backup)<>'object' or p_backup->>'schema'<>'teu7vd-backup-v1'
   or jsonb_typeof(p_backup->'giras')<>'array' or jsonb_typeof(p_backup->'reservas')<>'array'
   or jsonb_typeof(p_backup->'contadores_senha')<>'array' or jsonb_typeof(p_backup->'configuracoes_portal')<>'array' then
  raise exception using errcode='22023',message='Formato de backup incompatível.';
 end if;
 v_giras:=jsonb_array_length(p_backup->'giras');
 v_reservas:=jsonb_array_length(p_backup->'reservas');
 v_contadores:=jsonb_array_length(p_backup->'contadores_senha');
 if v_giras>10000 or v_reservas>10000 or v_contadores>10000 then
  raise exception using errcode='22023',message='Backup excede o limite de 10.000 registros por coleção.';
 end if;
 if exists(select 1 from jsonb_array_elements(p_backup->'giras') x where
   coalesce(x->>'id','') !~* '^[0-9a-f-]{36}$' or coalesce(x->>'titulo','')='' or coalesce(x->>'chave','')='') then
  raise exception using errcode='22023',message='Backup contém gira sem identificador, título ou chave válidos.';
 end if;
 if exists(select 1 from jsonb_array_elements(p_backup->'reservas') x where
   coalesce(x->>'id','') !~* '^[0-9a-f-]{36}$' or coalesce(x->>'gira_id','') !~* '^[0-9a-f-]{36}$'
   or coalesce(x->>'nome_completo','')='' or coalesce(x->>'senha_original','')='') then
  raise exception using errcode='22023',message='Backup contém reserva sem identificador, gira, nome ou senha original.';
 end if;
 insert into public.backup_restore_jobs(backup_schema,payload,resumo,criado_por)
 values('teu7vd-backup-v1',p_backup,jsonb_build_object('giras',v_giras,'reservas',v_reservas,'contadores_senha',v_contadores),p_actor_id)
 returning id into v_id;
 insert into public.auditoria(user_id,acao,entidade,entidade_id,detalhes)
 values(p_actor_id,'restauracao_backup_validada','backup_restore_job',v_id::text,
   jsonb_build_object('giras',v_giras,'reservas',v_reservas,'contadores_senha',v_contadores,'modo','merge_sem_exclusao'));
 return jsonb_build_object('success',true,'job_id',v_id,'resumo',jsonb_build_object('giras',v_giras,'reservas',v_reservas,'contadores_senha',v_contadores));
end;
$$;
revoke all on function public.teu7vd_preparar_restauracao_backup(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.teu7vd_preparar_restauracao_backup(uuid,jsonb) to service_role;

create or replace function public.teu7vd_aplicar_restauracao_backup(p_actor_id uuid,p_job_id uuid,p_motivo text)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_job public.backup_restore_jobs%rowtype; v_row jsonb; v_g public.giras%rowtype; v_r public.reservas%rowtype;
 v_count_g integer:=0; v_count_r integer:=0; v_count_c integer:=0; v_settings jsonb; v_occupied bigint;
begin
 if p_actor_id is null or not exists(select 1 from public.perfis_admin p where p.user_id=p_actor_id and p.ativo=true and p.papel='admin') then
  raise exception using errcode='42501',message='Apenas administrador ativo pode aplicar restauração.';
 end if;
 if length(trim(coalesce(p_motivo,'')))<10 or length(trim(coalesce(p_motivo,'')))>500 then
  raise exception using errcode='22023',message='Informe motivo da restauração entre 10 e 500 caracteres.';
 end if;
 select * into v_job from public.backup_restore_jobs where id=p_job_id for update;
 if not found or v_job.status<>'validado' then raise exception using errcode='P0002',message='Lote não encontrado ou já aplicado.'; end if;

 for v_row in select value from jsonb_array_elements(v_job.payload->'giras') loop
  select * into v_g from jsonb_populate_record(null::public.giras,v_row);
  insert into public.giras(id,titulo,data_gira,chave,limite_vagas,ativa,status,tipo_gira,created_at,updated_at)
  values(v_g.id,v_g.titulo,v_g.data_gira,v_g.chave,v_g.limite_vagas,v_g.ativa,v_g.status,v_g.tipo_gira,coalesce(v_g.created_at,now()),coalesce(v_g.updated_at,now()))
  on conflict(id) do update set titulo=excluded.titulo,data_gira=excluded.data_gira,chave=excluded.chave,ativa=excluded.ativa,status=excluded.status,tipo_gira=excluded.tipo_gira,updated_at=now(); -- preserva o limite operacional atual da gira existente.
  v_count_g:=v_count_g+1;
 end loop;

 for v_row in select value from jsonb_array_elements(v_job.payload->'reservas') loop
  select * into v_r from jsonb_populate_record(null::public.reservas,v_row);
  if not exists(select 1 from public.giras where id=v_r.gira_id) then raise exception using errcode='23503',message='Reserva do backup aponta para gira ausente.'; end if;
  select * into v_g from public.giras where id=v_r.gira_id for update;
  if v_r.status='ativa' and not exists(select 1 from public.reservas old where old.id=v_r.id and old.gira_id=v_r.gira_id and old.status='ativa') then
   select count(*) into v_occupied from public.reservas old where old.gira_id=v_r.gira_id and old.status='ativa';
   if v_g.limite_vagas is null or v_occupied>=v_g.limite_vagas then
    raise exception using errcode='P0001',message='Restauração excederia a capacidade de uma gira. Nenhuma alteração parcial foi confirmada.';
   end if;
  end if;
  insert into public.reservas(id,gira_id,senha_original,tipo_gira,senha_numero,nome_completo,data_nascimento,telefone,email,primeira_vez,retorno,medium_nome,preferencial,tipo_preferencial,descricao_preferencial,status,origem,legado_importado,linha_origem,created_at,updated_at,cancelada_em,cancelada_por,reaberta_em,reaberta_por,excluida_em,excluida_por,exclusao_motivo)
  values(v_r.id,v_r.gira_id,v_r.senha_original,v_r.tipo_gira,v_r.senha_numero,v_r.nome_completo,v_r.data_nascimento,v_r.telefone,v_r.email,v_r.primeira_vez,v_r.retorno,v_r.medium_nome,v_r.preferencial,v_r.tipo_preferencial,v_r.descricao_preferencial,v_r.status,v_r.origem,v_r.legado_importado,v_r.linha_origem,coalesce(v_r.created_at,now()),coalesce(v_r.updated_at,now()),v_r.cancelada_em,v_r.cancelada_por,v_r.reaberta_em,v_r.reaberta_por,v_r.excluida_em,v_r.excluida_por,v_r.exclusao_motivo)
  on conflict(id) do update set gira_id=excluded.gira_id,senha_original=excluded.senha_original,tipo_gira=excluded.tipo_gira,senha_numero=excluded.senha_numero,nome_completo=excluded.nome_completo,data_nascimento=excluded.data_nascimento,telefone=excluded.telefone,email=excluded.email,primeira_vez=excluded.primeira_vez,retorno=excluded.retorno,medium_nome=excluded.medium_nome,preferencial=excluded.preferencial,tipo_preferencial=excluded.tipo_preferencial,descricao_preferencial=excluded.descricao_preferencial,status=excluded.status,origem=excluded.origem,legado_importado=excluded.legado_importado,linha_origem=excluded.linha_origem,updated_at=now(),cancelada_em=excluded.cancelada_em,cancelada_por=excluded.cancelada_por,reaberta_em=excluded.reaberta_em,reaberta_por=excluded.reaberta_por,excluida_em=excluded.excluida_em,excluida_por=excluded.excluida_por,exclusao_motivo=excluded.exclusao_motivo;
  v_count_r:=v_count_r+1;
 end loop;

 for v_row in select value from jsonb_array_elements(v_job.payload->'contadores_senha') loop
  insert into public.contadores_senha(tipo_gira,proxima_senha,updated_at)
  values(v_row->>'tipo_gira',greatest(coalesce((v_row->>'proxima_senha')::bigint,1),1),coalesce((v_row->>'updated_at')::timestamptz,now()))
  on conflict(tipo_gira) do update set proxima_senha=greatest(public.contadores_senha.proxima_senha,excluded.proxima_senha),updated_at=now();
  v_count_c:=v_count_c+1;
 end loop;

 select value into v_settings from jsonb_array_elements(v_job.payload->'configuracoes_portal') limit 1;
 if v_settings is not null then
  update public.configuracoes_portal set mensagem_publica=coalesce(v_settings->>'mensagem_publica',mensagem_publica),
    mensagem_confirmacao=coalesce(v_settings->>'mensagem_confirmacao',mensagem_confirmacao),
    cor_primaria=case when coalesce(v_settings->>'cor_primaria','') ~ '^#[0-9A-Fa-f]{6}$' then v_settings->>'cor_primaria' else cor_primaria end,
    cor_destaque=case when coalesce(v_settings->>'cor_destaque','') ~ '^#[0-9A-Fa-f]{6}$' then v_settings->>'cor_destaque' else cor_destaque end,
    limite_alerta_vagas=case when coalesce(v_settings->>'limite_alerta_vagas','') ~ '^[0-9]+$' and (v_settings->>'limite_alerta_vagas')::integer between 0 and 10000 then (v_settings->>'limite_alerta_vagas')::integer else limite_alerta_vagas end,
    atualizado_por=p_actor_id,updated_at=now() where id=true;
 end if;
 update public.backup_restore_jobs set status='aplicado',aplicado_por=p_actor_id,motivo_aplicacao=trim(p_motivo),applied_at=now() where id=p_job_id;
 insert into public.auditoria(user_id,acao,entidade,entidade_id,detalhes)
 values(p_actor_id,'restauracao_backup_aplicada','backup_restore_job',p_job_id::text,
  jsonb_build_object('giras',v_count_g,'reservas',v_count_r,'contadores_senha',v_count_c,'motivo',trim(p_motivo),'modo','merge_sem_exclusao'));
 return jsonb_build_object('success',true,'giras',v_count_g,'reservas',v_count_r,'contadores_senha',v_count_c);
end;
$$;
revoke all on function public.teu7vd_aplicar_restauracao_backup(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.teu7vd_aplicar_restauracao_backup(uuid,uuid,text) to service_role;
