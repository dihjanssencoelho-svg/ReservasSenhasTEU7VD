-- TEU7VD | Esquema inicial de homologação
-- Cria estrutura vazia; não importa consulentes nem publica reservas.
create extension if not exists pgcrypto;

create table if not exists public.giras (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  data_gira date not null,
  chave text not null unique,
  limite_vagas integer check (limite_vagas is null or limite_vagas >= 0),
  ativa boolean not null default false,
  status text not null default 'validar'
    check (status in ('validar','homologada','publicada','inativa')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  gira_id uuid not null references public.giras(id) on delete restrict,
  senha_original text not null,
  nome_completo text not null,
  data_nascimento date,
  telefone text,
  email text,
  primeira_vez text,
  retorno text,
  medium_nome text,
  preferencial boolean not null default false,
  tipo_preferencial text,
  status text not null default 'pendente_validacao'
    check (status in ('ativa','cancelada','pendente_validacao')),
  origem text not null default 'site',
  legado_importado boolean not null default false,
  linha_origem integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reservas_gira_idx on public.reservas(gira_id);
create index if not exists reservas_nome_idx on public.reservas(lower(nome_completo));
create index if not exists reservas_email_idx on public.reservas(lower(email));

create table if not exists public.perfis_admin (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  papel text not null default 'operador'
    check (papel in ('admin','gestor','operador')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.auditoria (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  acao text not null,
  entidade text not null,
  entidade_id text,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.giras enable row level security;
alter table public.reservas enable row level security;
alter table public.perfis_admin enable row level security;
alter table public.auditoria enable row level security;

drop policy if exists giras_publicadas_select on public.giras;
create policy giras_publicadas_select on public.giras
for select to anon, authenticated
using (ativa = true and status = 'publicada');

drop policy if exists giras_admin_select on public.giras;
create policy giras_admin_select on public.giras
for select to authenticated using (
  exists (select 1 from public.perfis_admin p
          where p.user_id = auth.uid() and p.ativo = true)
);

drop policy if exists perfis_admin_select_self on public.perfis_admin;
create policy perfis_admin_select_self on public.perfis_admin
for select to authenticated using (user_id = auth.uid());

drop policy if exists reservas_admin_select on public.reservas;
create policy reservas_admin_select on public.reservas
for select to authenticated using (
  exists (select 1 from public.perfis_admin p
          where p.user_id = auth.uid() and p.ativo = true)
);

drop policy if exists auditoria_admin_select on public.auditoria;
create policy auditoria_admin_select on public.auditoria
for select to authenticated using (
  exists (select 1 from public.perfis_admin p
          where p.user_id = auth.uid() and p.ativo = true)
);