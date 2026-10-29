-- Allow the public reservation flow to omit email while preserving the existing RPC contract.
-- Applied only to the staging Supabase project emwnytvlbpgiwqswojze.
DO $migration$
DECLARE v_definition text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_definition
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='teu7vd_criar_reserva'
    AND pg_get_function_identity_arguments(p.oid) LIKE 'p_gira_id uuid, p_nome_completo text, p_data_nascimento date, p_telefone text, p_email text%';
  IF v_definition IS NULL THEN RAISE EXCEPTION 'Função teu7vd_criar_reserva não encontrada'; END IF;
  IF position($needle$or v_email = ''$needle$ in v_definition)>0 THEN
    v_definition := replace(v_definition,$old$or v_email = '' or v_telefone = ''$old$,$new$or v_telefone = ''$new$);
    v_definition := replace(v_definition,$old$p_data_nascimento, trim(p_telefone), v_email, trim(p_primeira_vez)$old$,$new$p_data_nascimento, trim(p_telefone), nullif(v_email, ''), trim(p_primeira_vez)$new$);
    EXECUTE v_definition;
  END IF;
END
$migration$;
