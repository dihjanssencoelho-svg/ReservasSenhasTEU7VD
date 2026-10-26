-- Fase 15: RPCs administrativas com identidade de ator validada pela Edge Function.
-- Estas funções continuam invocáveis apenas por service_role; nunca conceder EXECUTE ao browser.
create or replace function public.teu7vd_cancelar_reserva_v2(p_reserva_id uuid, p_motivo text default null, p_actor_id uuid default null)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_r public.reservas%rowtype;
begin
  if p_actor_id is null or not exists (select 1 from public.perfis_admin p where p.user_id=p_actor_id and p.ativo=true and p.papel='admin') then
    raise exception using errcode='42501', message='Ator administrativo não autorizado.';
  end if;
  select * into v_r from public.reservas where id=p_reserva_id for update;
  if not found or v_r.status='excluida' then raise exception using errcode='P0002', message='Reserva não encontrada ou excluída.'; end if;
  if v_r.status <> 'cancelada' then
    update public.reservas set status='cancelada', cancelada_em=now(), cancelada_por=p_actor_id, updated_at=now() where id=p_reserva_id;
    insert into public.auditoria(user_id,acao,entidade,entidade_id,detalhes)
    values (p_actor_id,'reserva_cancelada','reserva',p_reserva_id::text,jsonb_build_object('motivo',nullif(trim(coalesce(p_motivo,'')),'')));
  end if;
  return true;
end; $$;

create or replace function public.teu7vd_reabrir_reserva_v2(p_reserva_id uuid, p_motivo text, p_actor_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_r public.reservas%rowtype; v_g public.giras%rowtype; v_count bigint;
begin
  if p_actor_id is null or not exists (select 1 from public.perfis_admin p where p.user_id=p_actor_id and p.ativo=true and p.papel='admin') then
    raise exception using errcode='42501', message='Ator administrativo não autorizado.';
  end if;
  if nullif(trim(coalesce(p_motivo,'')),'') is null then raise exception using errcode='22023', message='Informe o motivo da reabertura.'; end if;
  select * into v_r from public.reservas where id=p_reserva_id for update;
  if not found or v_r.status <> 'cancelada' then raise exception using errcode='P0002', message='Somente reservas canceladas podem ser reabertas.'; end if;
  select * into v_g from public.giras where id=v_r.gira_id for update;
  if not found then raise exception using errcode='P0002', message='Gira da reserva não encontrada.'; end if;
  select count(*) into v_count from public.reservas where gira_id=v_r.gira_id and status='ativa';
  if not v_g.ativa or v_g.status <> 'publicada' or v_g.limite_vagas is null or v_count >= v_g.limite_vagas then
    raise exception using errcode='P0001', message='Não há vaga disponível para reabrir esta reserva.';
  end if;
  if exists(select 1 from public.reservas r where r.id<>v_r.id and r.gira_id=v_r.gira_id and r.status in ('ativa','pendente_validacao')
    and regexp_replace(lower(trim(r.nome_completo)), '[[:space:]]+', ' ', 'g')=regexp_replace(lower(trim(v_r.nome_completo)), '[[:space:]]+', ' ', 'g')
    and r.data_nascimento=v_r.data_nascimento
    and (lower(trim(coalesce(r.email,'')))=lower(trim(coalesce(v_r.email,'')))
      or regexp_replace(coalesce(r.telefone,''), '[^0-9]', '', 'g')=regexp_replace(coalesce(v_r.telefone,''), '[^0-9]', '', 'g'))) then
    raise exception using errcode='23505', message='Já existe outra reserva para esta pessoa nesta gira/data.';
  end if;
  update public.reservas set status='ativa', reaberta_em=now(), reaberta_por=p_actor_id, updated_at=now() where id=p_reserva_id;
  insert into public.auditoria(user_id,acao,entidade,entidade_id,detalhes) values (p_actor_id,'reserva_reaberta','reserva',p_reserva_id::text,jsonb_build_object('motivo',trim(p_motivo)));
  return true;
end; $$;

create or replace function public.teu7vd_excluir_reserva_v2(p_reserva_id uuid, p_motivo text, p_actor_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_r public.reservas%rowtype;
begin
  if p_actor_id is null or not exists (select 1 from public.perfis_admin p where p.user_id=p_actor_id and p.ativo=true and p.papel='admin') then
    raise exception using errcode='42501', message='Ator administrativo não autorizado.';
  end if;
  if nullif(trim(coalesce(p_motivo,'')),'') is null then raise exception using errcode='22023', message='Informe o motivo da exclusão.'; end if;
  select * into v_r from public.reservas where id=p_reserva_id for update;
  if not found or v_r.status='excluida' then raise exception using errcode='P0002', message='Reserva não encontrada ou já excluída.'; end if;
  update public.reservas set status='excluida', exclusao_motivo=trim(p_motivo), excluida_em=now(), excluida_por=p_actor_id, updated_at=now() where id=p_reserva_id;
  insert into public.auditoria(user_id,acao,entidade,entidade_id,detalhes) values (p_actor_id,'reserva_excluida','reserva',p_reserva_id::text,jsonb_build_object('motivo',trim(p_motivo)));
  return true;
end; $$;

revoke all on function public.teu7vd_cancelar_reserva_v2(uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.teu7vd_reabrir_reserva_v2(uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.teu7vd_excluir_reserva_v2(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.teu7vd_cancelar_reserva_v2(uuid,text,uuid) to service_role;
grant execute on function public.teu7vd_reabrir_reserva_v2(uuid,text,uuid) to service_role;
grant execute on function public.teu7vd_excluir_reserva_v2(uuid,text,uuid) to service_role;
