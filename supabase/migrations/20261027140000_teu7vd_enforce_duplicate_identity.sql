-- TEU7VD: defesa final contra duplicidades concorrentes no próprio PostgreSQL.
-- Aplicar somente após conferir e tratar eventuais duplicidades preexistentes.
-- Não altera nem remove reservas; se já houver conflito, a migração falha de forma segura.

create unique index if not exists reservas_identidade_gira_unique
  on public.reservas (
    gira_id,
    regexp_replace(lower(trim(regexp_replace(coalesce(nome_completo, ''), '[[:space:]]+', ' ', 'g'))), '[[:space:]]+', ' ', 'g'),
    coalesce(data_nascimento, date '0001-01-01'),
    lower(trim(coalesce(email, ''))),
    regexp_replace(coalesce(telefone, ''), '[^0-9]', '', 'g')
  )
  where status in ('ativa', 'pendente_validacao');

comment on index public.reservas_identidade_gira_unique is
  'Impede duplicidade por gira, nome normalizado, nascimento, e-mail e telefone normalizado, inclusive em requisições concorrentes.';
