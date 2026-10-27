-- TEU7VD: métricas públicas sem expor reservas e configurações institucionais controladas.
create table if not exists public.configuracoes_portal (
  id boolean primary key default true check (id = true),
  mensagem_publica text not null default 'As reservas dependem de disponibilidade e validação.',
  mensagem_confirmacao text not null default 'Solicitação recebida com sucesso.',
  cor_primaria text not null default '#17131e' check (cor_primaria ~ '^#[0-9A-Fa-f]{6}$'),
  cor_destaque text not null default '#c9a86a' check (cor_destaque ~ '^#[0-9A-Fa-f]{6}$'),
  limite_alerta_vagas integer not null default 5 check (limite_alerta_vagas between 0 and 10000),
  atualizado_por uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.configuracoes_portal(id) values (true) on conflict (id) do nothing;
alter table public.configuracoes_portal enable row level security;
revoke all on public.configuracoes_portal from anon, authenticated;
grant select on public.configuracoes_portal to authenticated;
drop policy if exists configuracoes_portal_admin_select on public.configuracoes_portal;
create policy configuracoes_portal_admin_select on public.configuracoes_portal
for select to authenticated
using (exists(select 1 from public.perfis_admin p where p.user_id=(select auth.uid()) and p.ativo=true and p.papel='admin'));

create or replace function public.teu7vd_resumo_vagas_publico()
returns table (
  gira_id uuid,
  limite_vagas integer,
  ocupadas bigint,
  vagas_restantes bigint,
  ocupacao_percentual numeric,
  poucas_vagas boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.limite_vagas,
    count(r.id) filter (where r.status='ativa') as ocupadas,
    greatest(g.limite_vagas::bigint - count(r.id) filter (where r.status='ativa'), 0) as vagas_restantes,
    case when g.limite_vagas > 0
      then round(100.0 * count(r.id) filter (where r.status='ativa') / g.limite_vagas, 1)
      else 100::numeric end as ocupacao_percentual,
    (g.limite_vagas - count(r.id) filter (where r.status='ativa')) <= coalesce(c.limite_alerta_vagas,5) as poucas_vagas
  from public.giras g
  left join public.reservas r on r.gira_id=g.id
  left join public.configuracoes_portal c on c.id=true
  where g.ativa=true and g.status='publicada' and g.limite_vagas is not null
  group by g.id,g.limite_vagas,c.limite_alerta_vagas;
$$;
revoke all on function public.teu7vd_resumo_vagas_publico() from public;
grant execute on function public.teu7vd_resumo_vagas_publico() to anon, authenticated;

create or replace function public.teu7vd_atualizar_configuracoes_portal(
  p_mensagem_publica text,
  p_mensagem_confirmacao text,
  p_cor_primaria text,
  p_cor_destaque text,
  p_limite_alerta_vagas integer,
  p_actor_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor_id is null or not exists (
    select 1 from public.perfis_admin p where p.user_id=p_actor_id and p.ativo=true and p.papel='admin'
  ) then
    raise exception using errcode='42501', message='Apenas administrador ativo pode alterar configurações.';
  end if;
  if length(trim(coalesce(p_mensagem_publica,''))) not between 1 and 500
    or length(trim(coalesce(p_mensagem_confirmacao,''))) not between 1 and 500
    or coalesce(p_cor_primaria,'') !~ '^#[0-9A-Fa-f]{6}$'
    or coalesce(p_cor_destaque,'') !~ '^#[0-9A-Fa-f]{6}$'
    or p_limite_alerta_vagas not between 0 and 10000 then
    raise exception using errcode='22023', message='Configuração inválida.';
  end if;
  update public.configuracoes_portal set mensagem_publica=trim(p_mensagem_publica),
    mensagem_confirmacao=trim(p_mensagem_confirmacao),cor_primaria=p_cor_primaria,
    cor_destaque=p_cor_destaque,limite_alerta_vagas=p_limite_alerta_vagas,
    atualizado_por=p_actor_id,updated_at=now() where id=true;
  insert into public.auditoria(user_id,acao,entidade,entidade_id,detalhes)
  values(p_actor_id,'configuracoes_portal_atualizadas','configuracoes_portal','singleton',
    jsonb_build_object('cor_primaria',p_cor_primaria,'cor_destaque',p_cor_destaque,
      'limite_alerta_vagas',p_limite_alerta_vagas,'mensagens_alteradas',true));
  return true;
end;
$$;
revoke all on function public.teu7vd_atualizar_configuracoes_portal(text,text,text,text,integer,uuid) from public, anon, authenticated;
grant execute on function public.teu7vd_atualizar_configuracoes_portal(text,text,text,text,integer,uuid) to service_role;

comment on function public.teu7vd_resumo_vagas_publico() is 'Retorna apenas contagens agregadas de vagas para giras publicadas; nunca retorna dados pessoais.';
