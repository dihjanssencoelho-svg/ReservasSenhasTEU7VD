create index if not exists reservas_cancelada_por_idx on public.reservas(cancelada_por);
create index if not exists reservas_excluida_por_idx on public.reservas(excluida_por);
create index if not exists reservas_reaberta_por_idx on public.reservas(reaberta_por);

-- Keep the ticket counter private to server-side functions.
revoke all on table public.contadores_senha from anon, authenticated;
