-- Admin-only return/medium updates with an audit event. Applied to staging only.
CREATE OR REPLACE FUNCTION public.teu7vd_atualizar_retorno_reserva(
  p_reserva_id uuid,
  p_retorno text,
  p_medium_nome text,
  p_actor_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_retorno text := nullif(trim(coalesce(p_retorno, '')), '');
  v_medium text := nullif(trim(coalesce(p_medium_nome, '')), '');
BEGIN
  IF p_reserva_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Identificador obrigatório' USING ERRCODE = '22023';
  END IF;
  IF v_retorno IS NOT NULL AND v_retorno NOT IN ('Sim', 'Não') THEN
    RAISE EXCEPTION 'Retorno inválido' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(v_medium, '')) > 180 THEN
    RAISE EXCEPTION 'Nome do médium excede o limite' USING ERRCODE = '22023';
  END IF;
  IF v_retorno IS DISTINCT FROM 'Sim' THEN v_medium := NULL; END IF;

  UPDATE public.reservas SET retorno = v_retorno, medium_nome = v_medium WHERE id = p_reserva_id;
  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO public.auditoria(acao, entidade, entidade_id, detalhes)
  VALUES ('reserva_retorno_atualizado','reserva',p_reserva_id::text,
    jsonb_build_object('actor_id',p_actor_id,'retorno',v_retorno,'medium_nome_preenchido',v_medium IS NOT NULL));
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.teu7vd_atualizar_retorno_reserva(uuid,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teu7vd_atualizar_retorno_reserva(uuid,text,text,uuid) TO service_role;
