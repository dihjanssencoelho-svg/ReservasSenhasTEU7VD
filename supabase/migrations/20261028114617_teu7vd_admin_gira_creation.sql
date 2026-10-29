-- Cadastro administrativo de giras com limite de senhas e auditoria.
create or replace function public.teu7vd_criar_gira(
  p_titulo text,
  p_data_gira date,
  p_tipo_gira text,
  p_limite_vagas integer,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_chave text;
  v_titulo text := trim(coalesce(p_titulo, ''));
  v_tipo text := trim(coalesce(p_tipo_gira, ''));
begin
  if p_actor_id is null or not exists (
    select 1 from public.perfis_admin p
    where p.user_id = p_actor_id and p.ativo = true and p.papel = 'admin'
  ) then
    raise exception using errcode = '42501', message = 'Somente administrador ativo pode cadastrar giras.';
  end if;

  if length(v_titulo) not between 3 and 120
    or p_data_gira is null
    or length(v_tipo) not between 1 and 80
    or p_limite_vagas not between 1 and 10000 then
    raise exception using errcode = '22023', message = 'Informe nome, data, tipo e quantidade válida de senhas.';
  end if;

  if exists (
    select 1 from public.giras g
    where lower(trim(g.titulo)) = lower(v_titulo)
      and g.data_gira = p_data_gira
      and g.status <> 'inativa'
  ) then
    raise exception using errcode = '23505', message = 'Já existe uma gira com esse nome nesta data.';
  end if;

  v_chave := 'admin-' || gen_random_uuid()::text;
  insert into public.giras(titulo, data_gira, chave, limite_vagas, ativa, status, tipo_gira)
  values (v_titulo, p_data_gira, v_chave, p_limite_vagas, true, 'publicada', v_tipo)
  returning id into v_id;

  insert into public.auditoria(user_id, acao, entidade, entidade_id, detalhes)
  values (
    p_actor_id, 'gira_criada', 'gira', v_id::text,
    jsonb_build_object(
      'titulo', v_titulo,
      'data_gira', p_data_gira,
      'tipo_gira', v_tipo,
      'limite_vagas', p_limite_vagas,
      'status', 'publicada'
    )
  );

  return jsonb_build_object(
    'success', true,
    'gira_id', v_id,
    'message', 'Gira cadastrada e publicada com ' || p_limite_vagas || ' senhas disponíveis.'
  );
end;
$$;

revoke all on function public.teu7vd_criar_gira(text, date, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.teu7vd_criar_gira(text, date, text, integer, uuid) to service_role;

comment on function public.teu7vd_criar_gira(text, date, text, integer, uuid)
is 'Cria uma gira publicada com limite de senhas e auditoria; chamada apenas pelo backend administrativo.';
