-- Ordinary admin reservation creation: only gira is required; preserve capacity and audit.
ALTER TABLE public.reservas ALTER COLUMN nome_completo DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.teu7vd_criar_reserva_painel(
  p_actor_id uuid,
  p_gira_id uuid,
  p_nome_completo text DEFAULT NULL,
  p_data_nascimento date DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_primeira_vez text DEFAULT NULL,
  p_preferencial boolean DEFAULT false,
  p_tipo_preferencial text DEFAULT NULL,
  p_descricao_preferencial text DEFAULT NULL,
  p_retorno text DEFAULT NULL,
  p_medium_nome text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_gira public.giras%rowtype;
  v_nome text := nullif(trim(coalesce(p_nome_completo,'')), '');
  v_email text := nullif(lower(trim(coalesce(p_email,''))), '');
  v_telefone text := nullif(trim(coalesce(p_telefone,'')), '');
  v_primeira text := nullif(trim(coalesce(p_primeira_vez,'')), '');
  v_tipo text := nullif(trim(coalesce(p_tipo_preferencial,'')), '');
  v_descricao text := nullif(trim(coalesce(p_descricao_preferencial,'')), '');
  v_retorno text := nullif(trim(coalesce(p_retorno,'')), '');
  v_medium text := nullif(trim(coalesce(p_medium_nome,'')), '');
  v_ocupadas bigint;
  v_senha bigint;
  v_id uuid;
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.perfis_admin p
    WHERE p.user_id=p_actor_id AND p.ativo=true AND p.papel='admin'
  ) THEN
    RAISE EXCEPTION 'Apenas administrador ativo pode cadastrar reserva' USING ERRCODE='42501';
  END IF;
  IF p_gira_id IS NULL THEN RAISE EXCEPTION 'Selecione a gira' USING ERRCODE='22023'; END IF;
  IF length(coalesce(v_nome,''))>180 OR length(coalesce(v_telefone,''))>32 OR length(coalesce(v_email,''))>254
     OR (v_email IS NOT NULL AND v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
     OR (v_primeira IS NOT NULL AND v_primeira NOT IN ('Sim','Não'))
     OR (v_retorno IS NOT NULL AND v_retorno NOT IN ('Sim','Não'))
     OR length(coalesce(v_medium,''))>180 OR length(coalesce(v_descricao,''))>300 THEN
    RAISE EXCEPTION 'Confira os campos informados' USING ERRCODE='22023';
  END IF;
  IF coalesce(p_preferencial,false) AND coalesce(v_tipo,'') NOT IN ('Gestante','Idoso','Criança de Colo','PCD','Outro') THEN
    RAISE EXCEPTION 'Selecione um tipo preferencial válido' USING ERRCODE='22023';
  END IF;
  IF coalesce(p_preferencial,false) AND v_tipo='Outro' AND v_descricao IS NULL THEN
    RAISE EXCEPTION 'Descreva a necessidade preferencial' USING ERRCODE='22023';
  END IF;
  IF NOT coalesce(p_preferencial,false) THEN v_tipo:=NULL; v_descricao:=NULL; END IF;
  IF v_retorno IS DISTINCT FROM 'Sim' THEN v_medium:=NULL; END IF;

  SELECT * INTO v_gira FROM public.giras WHERE id=p_gira_id FOR UPDATE;
  IF NOT FOUND OR NOT v_gira.ativa OR v_gira.status <> 'publicada' OR v_gira.limite_vagas IS NULL
     OR nullif(trim(coalesce(v_gira.tipo_gira,'')),'') IS NULL THEN
    RAISE EXCEPTION 'A gira precisa estar ativa, publicada e configurada' USING ERRCODE='P0001';
  END IF;

  IF v_nome IS NOT NULL AND p_data_nascimento IS NOT NULL AND (v_email IS NOT NULL OR v_telefone IS NOT NULL)
     AND EXISTS (
       SELECT 1 FROM public.reservas r WHERE r.gira_id=v_gira.id AND r.status IN ('ativa','pendente_validacao')
       AND regexp_replace(lower(trim(coalesce(r.nome_completo,''))), '[[:space:]]+', ' ', 'g') =
           regexp_replace(lower(v_nome), '[[:space:]]+', ' ', 'g')
       AND r.data_nascimento=p_data_nascimento
       AND ((v_email IS NOT NULL AND lower(trim(coalesce(r.email,'')))=v_email)
         OR (v_telefone IS NOT NULL AND regexp_replace(coalesce(r.telefone,''),'[^0-9]','','g')=regexp_replace(v_telefone,'[^0-9]','','g')))
     ) THEN
    RAISE EXCEPTION 'Já existe uma reserva para esta pessoa nesta gira/data' USING ERRCODE='23505';
  END IF;
  SELECT count(*) INTO v_ocupadas FROM public.reservas r WHERE r.gira_id=v_gira.id AND r.status='ativa';
  IF v_ocupadas >= v_gira.limite_vagas THEN
    RAISE EXCEPTION 'Esta gira atingiu o limite de vagas. Use o fluxo específico de excedente com justificativa.' USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.contadores_senha(tipo_gira,proxima_senha)
  VALUES(lower(trim(v_gira.tipo_gira)),2)
  ON CONFLICT(tipo_gira) DO UPDATE SET
    proxima_senha=public.contadores_senha.proxima_senha+1, updated_at=now()
  RETURNING proxima_senha-1 INTO v_senha;

  INSERT INTO public.reservas(
    gira_id,tipo_gira,senha_original,senha_numero,nome_completo,data_nascimento,telefone,email,
    primeira_vez,retorno,medium_nome,preferencial,tipo_preferencial,descricao_preferencial,status,origem
  ) VALUES (
    v_gira.id,lower(trim(v_gira.tipo_gira)),v_senha::text,v_senha,v_nome,p_data_nascimento,v_telefone,v_email,
    v_primeira,v_retorno,v_medium,coalesce(p_preferencial,false),v_tipo,v_descricao,'ativa','painel_admin'
  ) RETURNING id INTO v_id;

  INSERT INTO public.auditoria(user_id,acao,entidade,entidade_id,detalhes)
  VALUES(p_actor_id,'reserva_criada_painel_admin','reserva',v_id::text,
    jsonb_build_object('gira_id',v_gira.id,'origem','painel_admin','campos_opcionais_preenchidos',
      jsonb_build_array(
        CASE WHEN v_nome IS NOT NULL THEN 'nome_completo' END,
        CASE WHEN p_data_nascimento IS NOT NULL THEN 'data_nascimento' END,
        CASE WHEN v_telefone IS NOT NULL THEN 'telefone' END,
        CASE WHEN v_email IS NOT NULL THEN 'email' END
      )));
  RETURN jsonb_build_object('success',true,'message','Reserva administrativa registrada.','reservation_id',v_id,'senha',v_senha);
END;
$function$;

REVOKE ALL ON FUNCTION public.teu7vd_criar_reserva_painel(uuid,uuid,text,date,text,text,text,boolean,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teu7vd_criar_reserva_painel(uuid,uuid,text,date,text,text,text,boolean,text,text,text,text) TO service_role;
