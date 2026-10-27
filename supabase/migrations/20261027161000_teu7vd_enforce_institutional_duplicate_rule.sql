-- A regra de duplicidade institucional é: mesmo nome+nascimento e
-- mesmo e-mail OU mesmo telefone, dentro da mesma gira, para registros ativos/pendentes.
-- Índices separados garantem que a regra também resista a requisições concorrentes.
drop index if exists public.reservas_identidade_gira_unique;

create unique index if not exists reservas_identidade_email_gira_unique
  on public.reservas (
    gira_id,
    regexp_replace(lower(trim(regexp_replace(coalesce(nome_completo,''), '[[:space:]]+', ' ', 'g'))), '[[:space:]]+', ' ', 'g'),
    data_nascimento,
    lower(trim(coalesce(email,'')))
  )
  where status in ('ativa','pendente_validacao') and data_nascimento is not null
    and nullif(trim(coalesce(email,'')),'') is not null;

create unique index if not exists reservas_identidade_telefone_gira_unique
  on public.reservas (
    gira_id,
    regexp_replace(lower(trim(regexp_replace(coalesce(nome_completo,''), '[[:space:]]+', ' ', 'g'))), '[[:space:]]+', ' ', 'g'),
    data_nascimento,
    regexp_replace(coalesce(telefone,''), '[^0-9]', '', 'g')
  )
  where status in ('ativa','pendente_validacao') and data_nascimento is not null
    and nullif(regexp_replace(coalesce(telefone,''), '[^0-9]', '', 'g'),'') is not null;

comment on index public.reservas_identidade_email_gira_unique is
  'Bloqueia duplicidade por gira, nome, nascimento e e-mail normalizados.';
comment on index public.reservas_identidade_telefone_gira_unique is
  'Bloqueia duplicidade por gira, nome, nascimento e telefone normalizados.';
