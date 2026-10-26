-- Correções seguras de desempenho das políticas iniciais
create index if not exists auditoria_user_id_idx on public.auditoria(user_id);

drop policy if exists giras_publicadas_select on public.giras;
drop policy if exists giras_admin_select on public.giras;
create policy giras_publicadas_ou_admin_select on public.giras
for select to anon, authenticated
using (
  (ativa = true and status = 'publicada')
  or exists (
    select 1 from public.perfis_admin p
    where p.user_id = (select auth.uid()) and p.ativo = true
  )
);

drop policy if exists perfis_admin_select_self on public.perfis_admin;
create policy perfis_admin_select_self on public.perfis_admin
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists reservas_admin_select on public.reservas;
create policy reservas_admin_select on public.reservas
for select to authenticated
using (
  exists (
    select 1 from public.perfis_admin p
    where p.user_id = (select auth.uid()) and p.ativo = true
  )
);

drop policy if exists auditoria_admin_select on public.auditoria;
create policy auditoria_admin_select on public.auditoria
for select to authenticated
using (
  exists (
    select 1 from public.perfis_admin p
    where p.user_id = (select auth.uid()) and p.ativo = true
  )
);