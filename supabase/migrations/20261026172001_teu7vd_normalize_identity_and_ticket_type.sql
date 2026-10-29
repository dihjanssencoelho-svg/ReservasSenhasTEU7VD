-- Correção de normalização: comparar telefones por dígitos e normalizar o tipo da sequência.
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
  p_medium_nome text default null
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
  v_senha bigint;
  v_reserva_id uuid;
  v_ocupadas bigint;
begin
  v_nome := regexp_replace(lower(trim(coalesce(p_nome_completo,''))), '[[:space:]]+', ' ', 'g');
  v_email := lower(trim(coalesce(p_email,'')));
  v_telefone := regexp_replace(coalesce(p_telefone,''), '[^0-9]', '', 'g');
  v_tipo := nullif(trim(coalesce(p_tipo_preferencial,'')), '');

  if v_nome = '' or p_data_nascimento is null or v_email = '' or v_telefone = ''
     or nullif(trim(coalesce(p_primeira_vez,'')), '') is null then
    raise exception using errcode = '22023', message = 'Preencha todos os campos obrigatórios.';
  end if;
  if coalesce(p_preferencial,false) and v_tipo not in ('Gestante','Idoso','Criança de Colo','PCD','Outro') then
    raise exception using errcode = '22023', message = 'Selecione um tipo de atendimento preferencial válido.';
  end if;
  if not coalesce(p_preferencial,false) then v_tipo := null; end if;

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
    tipo_preferencial, status, origem
  ) values (
    v_gira.id, lower(trim(v_gira.tipo_gira)), v_senha::text, v_senha, trim(p_nome_completo),
    p_data_nascimento, trim(p_telefone), v_email, trim(p_primeira_vez),
    nullif(trim(coalesce(p_retorno,'')), ''), nullif(trim(coalesce(p_medium_nome,'')), ''),
    coalesce(p_preferencial,false), v_tipo, 'ativa', 'site'
  ) returning id into v_reserva_id;

  insert into public.auditoria(acao, entidade, entidade_id, detalhes)
  values ('reserva_criada','reserva',v_reserva_id::text,
          jsonb_build_object('gira_id',v_gira.id,'tipo_gira',lower(trim(v_gira.tipo_gira))));
  return jsonb_build_object('success',true,'message','Reserva realizada com sucesso.','reservation_id',v_reserva_id);
end;
$$;
revoke all on function public.teu7vd_criar_reserva(uuid,text,date,text,text,text,boolean,text,text,text) from public, anon, authenticated;
grant execute on function public.teu7vd_criar_reserva(uuid,text,date,text,text,text,boolean,text,text,text) to service_role;

create or replace function public.teu7vd_reabrir_reserva(p_reserva_id uuid, p_motivo text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_r public.reservas%rowtype; v_g public.giras%rowtype; v_count bigint;
begin
  if not public.teu7vd_is_admin() then
    raise exception using errcode = '42501', message = 'Apenas administrador pode reabrir reservas.';
  end if;
  if nullif(trim(coalesce(p_motivo,'')),'') is null then
    raise exception using errcode = '22023', message = 'Informe o motivo da reabertura.';
  end if;
  select * into v_r from public.reservas where id=p_reserva_id for update;
  if not found or v_r.status <> 'cancelada' then
    raise exception using errcode = 'P0002', message = 'Somente reservas canceladas podem ser reabertas.';
  end if;
  select * into v_g from public.giras where id=v_r.gira_id for update;
  select count(*) into v_count from public.reservas where gira_id=v_r.gira_id and status='ativa';
  if not v_g.ativa or v_g.status <> 'publicada' or v_g.limite_vagas is null or v_count >= v_g.limite_vagas then
    raise exception using errcode = 'P0001', message = 'Não há vaga disponível para reabrir esta reserva.';
  end if;
  if exists(select 1 from public.reservas r where r.id<>v_r.id and r.gira_id=v_r.gira_id
    and r.status in ('ativa','pendente_validacao')
    and regexp_replace(lower(trim(r.nome_completo)), '[[:space:]]+', ' ', 'g') =
        regexp_replace(lower(trim(v_r.nome_completo)), '[[:space:]]+', ' ', 'g')
    and r.data_nascimento=v_r.data_nascimento
    and (lower(trim(coalesce(r.email,'')))=lower(trim(coalesce(v_r.email,'')))
      or regexp_replace(coalesce(r.telefone,''), '[^0-9]', '', 'g')=regexp_replace(coalesce(v_r.telefone,''), '[^0-9]', '', 'g'))) then
    raise exception using errcode = '23505', message = 'Já existe outra reserva para esta pessoa nesta gira/data.';
  end if;
  update public.reservas set status='ativa', reaberta_em=now(), reaberta_por=(select auth.uid()), updated_at=now()
    where id=p_reserva_id;
  insert into public.auditoria(user_id,acao,entidade,entidade_id,detalhes)
    values ((select auth.uid()),'reserva_reaberta','reserva',p_reserva_id::text,jsonb_build_object('motivo',trim(p_motivo)));
  return true;
end;
$$;
revoke all on function public.teu7vd_reabrir_reserva(uuid,text) from public, anon;
grant execute on function public.teu7vd_reabrir_reserva(uuid,text) to authenticated;
