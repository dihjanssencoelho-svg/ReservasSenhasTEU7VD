-- Separate public agenda access from authenticated administrative visibility.
-- This prevents the anonymous role from evaluating the private profiles table.
drop policy if exists giras_publicadas_ou_admin_select on public.giras;

create policy giras_publicadas_select
on public.giras
for select
to anon, authenticated
using (ativa = true and status = 'publicada');

create policy giras_admin_select
on public.giras
for select
to authenticated
using (
  exists (
    select 1
    from public.perfis_admin p
    where p.user_id = (select auth.uid())
      and p.ativo = true
  )
);
