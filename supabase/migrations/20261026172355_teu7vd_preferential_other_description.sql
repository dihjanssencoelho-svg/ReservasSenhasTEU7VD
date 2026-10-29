alter table public.reservas add column if not exists descricao_preferencial text;

create or replace function public.teu7vd_criar_reserva(
  p_gira_id uuid,
  p_nome_completo text,
  p_data_nascimento date,
  p_telefone text,
  p_email text,
  p_primeira_vez text,
  p_preferencial boolean default false,
  p_tipo_preferencial text default null,
  p_retorno text default null,
  p_medium_nome text default null,
  p_descricao_preferencial text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gira public.giras%rowtype;
  v_nome text;
  v_email text;
  v_telefone text;
  v_tipo text;
  v_descricao text;
  v_senha bigint;
  v_reserva_id uuid;
  v_ocupadas bigint;
begin
  v_nome := regexp_replace(lower(trim(coalesce(p_nome_completo,''))), '[[:space:]]+', ' ', 'g');
  v_email := lower(trim(coalesce(p_email,'')));
  v_telefone := regexp_replace(coalesce(p_telefone,''), '[^0-9]', '', 'g');
  v_tipo := nullif(trim(coalesce(p_tipo_preferencial,'')), '');
  v_descricao := nullif(trim(coalesce(p_descricao_preferencial,'')), '');

  if v_nome = '' or p_data_nascimento is null or v_email = '' or v_telefone = ''
     or nullif(trim(coalesce(p_primeira_vez,'')), '') is null then
    raise exception using errcode = '22023', message = 'Preencha todos os campos obrigatórios.';
  end if;
  if coalesce(p_preferencial,false) and v_tipo not in ('Gestante','Idoso','Criança de Colo','PCD','Outro') then
    raise exception using errcode = '22023', message = 'Selecione um tipo de atendimento preferencial válido.';
  end if;
  if coalesce(p_preferencial,false) and v_tipo = 'Outro' and v_descricao is null then
    raise exception using errcode = '22023', message = 'Descreva a necessidade de atendimento preferencial.';
  end if;
  if not coalesce(p_preferencial,false) then
    v_tipo := null;
    v_descricao := null;
  end if;

  select * into v_gira from public.giras where id = p_gira_id for update;
  if not found or not v_gira.ativa or v_gira.status <> 'publicada' or v_gira.limite_vagas is null then
    raise exception using errcode = 'P0001', message = 'Esta gira não está disponível para reservas.';
  end if;
  if nullif(trim(coalesce(v_gira.tipo_gira,'')), '') is null then
    raise exception using errcode = 'P0001', message = 'O tipo desta gira ainda não foi configurado.';
  end if;

  if exists (
    select 1 from public.reservas r
    where r.gira_id = v_gira.id and r.status in ('ativa','pendente_validacao')
      and regexp_replace(lower(trim(r.nome_completo)), '[[:space:]]+', ' ', 'g') = v_nome
      and r.data_nascimento = p_data_nascimento
      and (
        lower(trim(coalesce(r.email,''))) = v_email
        or regexp_replace(coalesce(r.telefone,''), '[^0-9]', '', 'g') = v_telefone
      )
  ) then
    raise exception using errcode = '23505', message = 'Já existe uma reserva para esta pessoa nesta gira/data.';
  end if;

  select count(*) into v_ocupadas from public.reservas r
    where r.gira_id = v_gira.id and r.status = 'ativa';
  if v_ocupadas >= v_gira.limite_vagas then
    raise exception using errcode = 'P0001', message = 'Esta gira atingiu o limite de vagas.';
  end if;

  insert into public.contadores_senha(tipo_gira, proxima_senha)
    values (lower(trim(v_gira.tipo_gira)), 2)
    on conflict (tipo_gira) do update
      set proxima_senha = public.contadores_senha.proxima_senha + 1,
          updated_at = now()
    returning proxima_senha - 1 into v_senha;

  insert into public.reservas(
    gira_id, tipo_gira, senha_original, senha_numero, nome_completo, data_nascimento,
    telefone, email, primeira_vez, retorno, medium_nome, preferencial,
    tipo_preferencial, descricao_preferencial, status, origem
  ) values (
    v_gira.id, lower(trim(v_gira.tipo_gira)), v_senha::text, v_senha, trim(p_nome_completo),
    p_data_nascimento, trim(p_telefone), v_email, trim(p_primeira_vez),
    nullif(trim(coalesce(p_retorno,'')), ''), nullif(trim(coalesce(p_medium_nome,'')), ''),
    coalesce(p_preferencial,false), v_tipo, v_descricao, 'ativa', 'site'
  ) returning id into v_reserva_id;

  insert into public.auditoria(acao, entidade, entidade_id, detalhes)
  values ('reserva_criada','reserva',v_reserva_id::text,
          jsonb_build_object('gira_id',v_gira.id,'tipo_gira',lower(trim(v_gira.tipo_gira))));
  return jsonb_build_object('success',true,'message','Reserva realizada com sucesso.','reservation_id',v_reserva_id);
end;
$$;
revoke all on function public.teu7vd_criar_reserva(uuid,text,date,text,text,text,boolean,text,text,text,text) from public, anon, authenticated;
grant execute on function public.teu7vd_criar_reserva(uuid,text,date,text,text,text,boolean,text,text,text,text) to service_role;
