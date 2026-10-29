-- Least privilege: public agenda/profile lookups need SELECT only.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.giras, public.perfis_admin
FROM anon, authenticated;
