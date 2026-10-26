-- O acesso a dados pessoais passa exclusivamente pelas APIs server-side autorizadas.
-- A agenda pública continua legível por sua política específica em public.giras.
REVOKE ALL PRIVILEGES ON TABLE public.reservas FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.auditoria FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.contadores_senha FROM anon, authenticated;
