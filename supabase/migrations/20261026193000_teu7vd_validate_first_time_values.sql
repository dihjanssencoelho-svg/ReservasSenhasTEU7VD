-- Fase 22: restringe primeira_vez aos valores confirmados no formulário legado.
-- A restrição NOT VALID protege novas gravações sem bloquear a migração caso existam
-- dados históricos antigos fora do contrato; a homologação deve auditar esses dados.
alter table public.reservas
  add constraint reservas_primeira_vez_valores_check
  check (primeira_vez is null or primeira_vez in ('Sim', 'Não')) not valid;
