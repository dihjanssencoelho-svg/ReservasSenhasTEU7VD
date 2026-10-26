-- Harden public API exposure of privileged reservation operations.
-- Administrative RPCs remain available to trusted server-side service_role only.
revoke all on function public.teu7vd_cancelar_reserva(uuid,text) from public, anon, authenticated;
revoke all on function public.teu7vd_excluir_reserva(uuid,text) from public, anon, authenticated;
revoke all on function public.teu7vd_reabrir_reserva(uuid,text) from public, anon, authenticated;
revoke all on function public.teu7vd_is_admin() from public, anon, authenticated;
revoke all on table public.contadores_senha from public, anon, authenticated;
