create or replace function public.teu7vd_configuracoes_publicas()
returns table (
  mensagem_publica text,
  mensagem_confirmacao text,
  cor_primaria text,
  cor_destaque text,
  limite_alerta_vagas integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.mensagem_publica,c.mensagem_confirmacao,c.cor_primaria,c.cor_destaque,c.limite_alerta_vagas
  from public.configuracoes_portal c where c.id=true;
$$;
revoke all on function public.teu7vd_configuracoes_publicas() from public;
grant execute on function public.teu7vd_configuracoes_publicas() to anon, authenticated;
