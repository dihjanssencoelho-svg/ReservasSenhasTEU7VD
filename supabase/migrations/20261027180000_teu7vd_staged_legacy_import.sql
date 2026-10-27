-- Importação histórica em duas etapas: staging/validação e aplicação atômica.
create table if not exists public.importacao_reservas_jobs (
 id uuid primary key default gen_random_uuid(),
 status text not null default 'validado' check(status in ('validado','aplicado')),
 payload jsonb not null,
 resumo jsonb not null default '{}'::jsonb,
 criado_por uuid not null references auth.users(id) on delete restrict,
 aplicado_por uuid references auth.users(id) on delete set null,
 motivo text,
 created_at timestamptz not null default now(),
 applied_at timestamptz
);
alter table public.importacao_reservas_jobs enable row level security;
revoke all on public.importacao_reservas_jobs from anon,authenticated;
grant select on public.importacao_reservas_jobs to authenticated;
drop policy if exists importacao_reservas_jobs_admin_select on public.importacao_reservas_jobs;
create policy importacao_reservas_jobs_admin_select on public.importacao_reservas_jobs for select to authenticated
using(exists(select 1 from public.perfis_admin p where p.user_id=(select auth.uid()) and p.ativo=true and p.papel='admin'));

create or replace function public.teu7vd_preparar_importacao_reservas(p_actor_id uuid,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_count integer;
begin
 if p_actor_id is null or not exists(select 1 from public.perfis_admin p where p.user_id=p_actor_id and p.ativo=true and p.papel='admin') then
  raise exception using errcode='42501',message='Apenas administrador ativo pode preparar importação.';
 end if;
 if jsonb_typeof(p_rows)<>'array' then raise exception using errcode='22023',message='Importação deve conter uma lista de linhas.'; end if;
 v_count:=jsonb_array_length(p_rows);
 if v_count<1 or v_count>5000 then raise exception using errcode='22023',message='A importação deve conter de 1 a 5.000 linhas.'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) x where
   coalesce(x->>'gira_id','') !~* '^[0-9a-f-]{36}$'
   or coalesce(x->>'nome_completo','')=''
   or coalesce(x->>'senha_original','')=''
   or coalesce(x->>'status','') not in ('ativa','cancelada','pendente_validacao','excluida')
   or (nullif(x->>'data_nascimento','') is not null and (x->>'data_nascimento') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2})
   or length(coalesce(x->>'nome_completo',''))>180
   or length(coalesce(x->>'senha_original',''))>80
   or length(coalesce(x->>'email',''))>254
   or length(coalesce(x->>'telefone',''))>32) then
  raise exception using errcode='22023',message='Há linha com gira, nome, senha, status ou campos em formato inválido.';
 end if;
 if exists(select 1 from jsonb_array_elements(p_rows) x left join public.giras g on g.id=(x->>'gira_id')::uuid where g.id is null) then
  raise exception using errcode='23503',message='Uma ou mais linhas referenciam gira inexistente. Mapeie a gira antes de importar.';
 end if;
 insert into public.importacao_reservas_jobs(payload,resumo,criado_por)
 values(p_rows,jsonb_build_object('linhas',v_count,'giras_distintas',(select count(distinct x->>'gira_id') from jsonb_array_elements(p_rows) x)),p_actor_id)
 returning id into v_id;
 insert into public.auditoria(user_id,acao,entidade,entidade_id,detalhes)
 values(p_actor_id,'importacao_reservas_validada','importacao_reservas_job',v_id::text,jsonb_build_object('linhas',v_count,'modo','staging_sem_mutacao'));
 return jsonb_build_object('success',true,'job_id',v_id,'resumo',jsonb_build_object('linhas',v_count));
end;
$$;
revoke all on function public.teu7vd_preparar_importacao_reservas(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.teu7vd_preparar_importacao_reservas(uuid,jsonb) to service_role;

create or replace function public.teu7vd_aplicar_importacao_reservas(p_actor_id uuid,p_job_id uuid,p_motivo text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_job public.importacao_reservas_jobs%rowtype; x jsonb; g public.giras%rowtype; v_id uuid;
 v_senha_num bigint; v_count integer:=0; v_active bigint; v_tipo text; v_status text; v_pref boolean;
begin
 if p_actor_id is null or not exists(select 1 from public.perfis_admin p where p.user_id=p_actor_id and p.ativo=true and p.papel='admin') then
  raise exception using errcode='42501',message='Apenas administrador ativo pode aplicar importação.';
 end if;
 if length(trim(coalesce(p_motivo,'')))<10 or length(trim(coalesce(p_motivo,'')))>500 then raise exception using errcode='22023',message='Informe motivo de importação entre 10 e 500 caracteres.'; end if;
 select * into v_job from public.importacao_reservas_jobs where id=p_job_id for update;
 if not found or v_job.status<>'validado' then raise exception using errcode='P0002',message='Lote não encontrado ou já aplicado.'; end if;
 for x in select value from jsonb_array_elements(v_job.payload) loop
  select * into g from public.giras where id=(x->>'gira_id')::uuid for update;
  if not found then raise exception using errcode='23503',message='Gira ausente durante aplicação.'; end if;
  v_status:=x->>'status'; v_pref:=coalesce((x->>'preferencial')::boolean,false);
  if v_pref and coalesce(x->>'tipo_preferencial','') not in ('Gestante','Idoso','Criança de Colo','PCD','Outro') then
   raise exception using errcode='22023',message='Tipo preferencial inválido em linha importada.';
  end if;
  if v_status='ativa' then
   select count(*) into v_active from public.reservas where gira_id=g.id and status='ativa';
   if g.limite_vagas is null or v_active>=g.limite_vagas then
    raise exception using errcode='P0001',message='Importação excederia a capacidade da gira. Revise as linhas ou use o formulário administrativo de excedente para casos autorizados.';
   end if;
  end if;
  v_tipo:=lower(trim(coalesce(g.tipo_gira,'')));
  if v_tipo='' then raise exception using errcode='22023',message='A gira não possui tipo configurado para numeração.'; end if;
  v_senha_num:=case when coalesce(x->>'senha_original','') ~ '^[0-9]+$' then (x->>'senha_original')::bigint else null end;
  insert into public.reservas(
   gira_id,tipo_gira,senha_original,senha_numero,nome_completo,data_nascimento,telefone,email,
   primeira_vez,retorno,medium_nome,preferencial,tipo_preferencial,descricao_preferencial,status,
   origem,legado_importado,linha_origem
  ) values (
   g.id,v_tipo,x->>'senha_original',v_senha_num,trim(x->>'nome_completo'),
   nullif(x->>'data_nascimento','')::date,nullif(trim(x->>'telefone'),''),nullif(lower(trim(x->>'email')),''),
   nullif(trim(x->>'primeira_vez'),''),nullif(trim(x->>'retorno'),''),nullif(trim(x->>'medium_nome'),''),
   v_pref,case when v_pref then nullif(trim(x->>'tipo_preferencial'),'') else null end,
   case when v_pref then nullif(trim(x->>'descricao_preferencial'),'') else null end,
   v_status,'importacao_validada',true,nullif(x->>'linha_origem','')::integer
  ) returning id into v_id;
  if v_senha_num is not null and v_status<>'excluida' then
   insert into public.contadores_senha(tipo_gira,proxima_senha) values(v_tipo,v_senha_num+1)
   on conflict(tipo_gira) do update set proxima_senha=greatest(public.contadores_senha.proxima_senha,excluded.proxima_senha),updated_at=now();
  end if;
  insert into public.auditoria(user_id,acao,entidade,entidade_id,detalhes)
  values(p_actor_id,'reserva_importada','reserva',v_id::text,jsonb_build_object('lote_id',p_job_id,'linha_origem',x->>'linha_origem','status',v_status));
  v_count:=v_count+1;
 end loop;
 update public.importacao_reservas_jobs set status='aplicado',aplicado_por=p_actor_id,motivo=trim(p_motivo),applied_at=now() where id=p_job_id;
 insert into public.auditoria(user_id,acao,entidade,entidade_id,detalhes)
 values(p_actor_id,'importacao_reservas_aplicada','importacao_reservas_job',p_job_id::text,jsonb_build_object('linhas_importadas',v_count,'motivo',trim(p_motivo)));
 return jsonb_build_object('success',true,'linhas_importadas',v_count);
end;
$$;
revoke all on function public.teu7vd_aplicar_importacao_reservas(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.teu7vd_aplicar_importacao_reservas(uuid,uuid,text) to service_role;
)
   or length(coalesce(x->>'nome_completo',''))>180
   or length(coalesce(x->>'senha_original',''))>80
   or length(coalesce(x->>'email',''))>254
   or length(coalesce(x->>'telefone',''))>32) then
  raise exception using errcode='22023',message='Há linha com gira, nome, senha, status ou campos em formato inválido.';
 end if;
 if exists(select 1 from jsonb_array_elements(p_rows) x left join public.giras g on g.id=(x->>'gira_id')::uuid where g.id is null) then
  raise exception using errcode='23503',message='Uma ou mais linhas referenciam gira inexistente. Mapeie a gira antes de importar.';
 end if;
 insert into public.importacao_reservas_jobs(payload,resumo,criado_por)
 values(p_rows,jsonb_build_object('linhas',v_count,'giras_distintas',(select count(distinct x->>'gira_id') from jsonb_array_elements(p_rows) x)),p_actor_id)
 returning id into v_id;
 insert into public.auditoria(user_id,acao,entidade,entidade_id,detalhes)
 values(p_actor_id,'importacao_reservas_validada','importacao_reservas_job',v_id::text,jsonb_build_object('linhas',v_count,'modo','staging_sem_mutacao'));
 return jsonb_build_object('success',true,'job_id',v_id,'resumo',jsonb_build_object('linhas',v_count));
end;
$$;
revoke all on function public.teu7vd_preparar_importacao_reservas(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.teu7vd_preparar_importacao_reservas(uuid,jsonb) to service_role;

create or replace function public.teu7vd_aplicar_importacao_reservas(p_actor_id uuid,p_job_id uuid,p_motivo text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_job public.importacao_reservas_jobs%rowtype; x jsonb; g public.giras%rowtype; v_id uuid;
 v_senha_num bigint; v_count integer:=0; v_active bigint; v_tipo text; v_status text; v_pref boolean;
begin
 if p_actor_id is null or not exists(select 1 from public.perfis_admin p where p.user_id=p_actor_id and p.ativo=true and p.papel='admin') then
  raise exception using errcode='42501',message='Apenas administrador ativo pode aplicar importação.';
 end if;
 if length(trim(coalesce(p_motivo,'')))<10 or length(trim(coalesce(p_motivo,'')))>500 then raise exception using errcode='22023',message='Informe motivo de importação entre 10 e 500 caracteres.'; end if;
 select * into v_job from public.importacao_reservas_jobs where id=p_job_id for update;
 if not found or v_job.status<>'validado' then raise exception using errcode='P0002',message='Lote não encontrado ou já aplicado.'; end if;
 for x in select value from jsonb_array_elements(v_job.payload) loop
  select * into g from public.giras where id=(x->>'gira_id')::uuid for update;
  if not found then raise exception using errcode='23503',message='Gira ausente durante aplicação.'; end if;
  v_status:=x->>'status'; v_pref:=coalesce((x->>'preferencial')::boolean,false);
  if v_pref and coalesce(x->>'tipo_preferencial','') not in ('Gestante','Idoso','Criança de Colo','PCD','Outro') then
   raise exception using errcode='22023',message='Tipo preferencial inválido em linha importada.';
  end if;
  if v_status='ativa' then
   select count(*) into v_active from public.reservas where gira_id=g.id and status='ativa';
   if g.limite_vagas is null or v_active>=g.limite_vagas then
    raise exception using errcode='P0001',message='Importação excederia a capacidade da gira. Revise as linhas ou use o formulário administrativo de excedente para casos autorizados.';
   end if;
  end if;
  v_tipo:=lower(trim(coalesce(g.tipo_gira,'')));
  if v_tipo='' then raise exception using errcode='22023',message='A gira não possui tipo configurado para numeração.'; end if;
  v_senha_num:=case when coalesce(x->>'senha_original','') ~ '^[0-9]+$' then (x->>'senha_original')::bigint else null end;
  insert into public.reservas(
   gira_id,tipo_gira,senha_original,senha_numero,nome_completo,data_nascimento,telefone,email,
   primeira_vez,retorno,medium_nome,preferencial,tipo_preferencial,descricao_preferencial,status,
   origem,legado_importado,linha_origem
  ) values (
   g.id,v_tipo,x->>'senha_original',v_senha_num,trim(x->>'nome_completo'),
   nullif(x->>'data_nascimento','')::date,nullif(trim(x->>'telefone'),''),nullif(lower(trim(x->>'email')),''),
   nullif(trim(x->>'primeira_vez'),''),nullif(trim(x->>'retorno'),''),nullif(trim(x->>'medium_nome'),''),
   v_pref,case when v_pref then nullif(trim(x->>'tipo_preferencial'),'') else null end,
   case when v_pref then nullif(trim(x->>'descricao_preferencial'),'') else null end,
   v_status,'importacao_validada',true,nullif(x->>'linha_origem','')::integer
  ) returning id into v_id;
  if v_senha_num is not null and v_status<>'excluida' then
   insert into public.contadores_senha(tipo_gira,proxima_senha) values(v_tipo,v_senha_num+1)
   on conflict(tipo_gira) do update set proxima_senha=greatest(public.contadores_senha.proxima_senha,excluded.proxima_senha),updated_at=now();
  end if;
  insert into public.auditoria(user_id,acao,entidade,entidade_id,detalhes)
  values(p_actor_id,'reserva_importada','reserva',v_id::text,jsonb_build_object('lote_id',p_job_id,'linha_origem',x->>'linha_origem','status',v_status));
  v_count:=v_count+1;
 end loop;
 update public.importacao_reservas_jobs set status='aplicado',aplicado_por=p_actor_id,motivo=trim(p_motivo),applied_at=now() where id=p_job_id;
 insert into public.auditoria(user_id,acao,entidade,entidade_id,detalhes)
 values(p_actor_id,'importacao_reservas_aplicada','importacao_reservas_job',p_job_id::text,jsonb_build_object('linhas_importadas',v_count,'motivo',trim(p_motivo)));
 return jsonb_build_object('success',true,'linhas_importadas',v_count);
end;
$$;
revoke all on function public.teu7vd_aplicar_importacao_reservas(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.teu7vd_aplicar_importacao_reservas(uuid,uuid,text) to service_role;
