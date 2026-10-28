-- Secure administrative deletion with audited number release.
-- The counter returns proxima_senha - 1, so releasing N rewinds to N + 1.
CREATE OR REPLACE FUNCTION public.teu7vd_excluir_reserva_v2(p_reserva_id uuid,p_motivo text,p_actor_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_r public.reservas%rowtype; v_tipo text;
BEGIN
 IF p_actor_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.perfis_admin p WHERE p.user_id=p_actor_id AND p.ativo=true AND p.papel='admin') THEN
  RAISE EXCEPTION 'Ator administrativo não autorizado.' USING ERRCODE='42501';
 END IF;
 IF length(trim(coalesce(p_motivo,'')))<5 OR length(trim(coalesce(p_motivo,'')))>500 THEN
  RAISE EXCEPTION 'Informe motivo de exclusão entre 5 e 500 caracteres.' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_r FROM public.reservas WHERE id=p_reserva_id FOR UPDATE;
 IF NOT FOUND OR v_r.status='excluida' THEN
  RAISE EXCEPTION 'Reserva não encontrada ou já excluída.' USING ERRCODE='P0002';
 END IF;
 v_tipo:=trim(coalesce(v_r.tipo_gira,''));
 UPDATE public.reservas SET status='excluida',exclusao_motivo=trim(p_motivo),excluida_em=now(),excluida_por=p_actor_id,updated_at=now() WHERE id=p_reserva_id;
 IF v_tipo<>'' AND v_r.senha_numero IS NOT NULL THEN
  INSERT INTO public.contadores_senha(tipo_gira,proxima_senha) VALUES(v_tipo,v_r.senha_numero+1)
  ON CONFLICT(tipo_gira) DO UPDATE SET proxima_senha=LEAST(public.contadores_senha.proxima_senha,EXCLUDED.proxima_senha),updated_at=now();
 END IF;
 INSERT INTO public.auditoria(user_id,acao,entidade,entidade_id,detalhes)
 VALUES(p_actor_id,'reserva_excluida','reserva',p_reserva_id::text,jsonb_build_object('motivo',trim(p_motivo),'gira_id',v_r.gira_id,'tipo_gira',v_tipo,'senha_liberada',v_r.senha_numero,'status_anterior',v_r.status));
 RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.teu7vd_excluir_reserva_v2(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.teu7vd_excluir_reserva_v2(uuid,text,uuid) TO service_role;
