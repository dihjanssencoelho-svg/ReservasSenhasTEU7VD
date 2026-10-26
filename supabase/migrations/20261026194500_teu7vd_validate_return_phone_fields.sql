-- Fase 23: restrições de contrato para retorno, nome do médium e telefone.
-- NOT VALID evita bloquear a criação por eventuais registros históricos incompatíveis;
-- as restrições passam a ser aplicadas a novas inserções/atualizações.
alter table public.reservas
  add constraint reservas_retorno_valores_check
  check (retorno is null or retorno in ('Sim', 'Não')) not valid;

alter table public.reservas
  add constraint reservas_medium_nome_tamanho_check
  check (medium_nome is null or length(medium_nome) <= 180) not valid;

alter table public.reservas
  add constraint reservas_medium_condicional_check
  check (medium_nome is null or (retorno = 'Sim' and length(trim(medium_nome)) > 0)) not valid;

alter table public.reservas
  add constraint reservas_telefone_digitos_check
  check (
    telefone is null or
    length(regexp_replace(telefone, '[^0-9]', '', 'g')) between 10 and 15
  ) not valid;
