# Fase 13 — Recuperação de migrações, grants e preparação de homologação

**Estado:** histórico recuperado do registro original do Supabase; correção de privilégio mínimo aplicada e versionada. Ainda não há homologação funcional concluída.

## 1. Fonte confiável e recuperação

Os nove registros de `supabase_migrations.schema_migrations` do projeto Supabase `emwnytvlbpgiwqswojze` continham o SQL original em `statements[1]`. Os arquivos foram recuperados literalmente desses registros e versionados em `supabase/migrations/`, preservando versões e nomes registrados:

- `20261026170140_teu7vd_initial_homologation_schema.sql`
- `20261026170152_teu7vd_rls_performance_fixes.sql`
- `20261026171938_teu7vd_transactional_reservations_admin.sql`
- `20261026172001_teu7vd_normalize_identity_and_ticket_type.sql`
- `20261026172101_teu7vd_admin_indexes_and_counter_privacy.sql`
- `20261026172355_teu7vd_preferential_other_description.sql`
- `20261026172531_teu7vd_restrict_internal_admin_helper.sql`
- `20261026172645_teu7vd_restrict_admin_rpc_and_counter.sql`
- `20261026173804_restrict_direct_reservation_table_access.sql`

O arquivo anteriormente versionado como `20261026190000_restrict_direct_reservation_table_access.sql` foi removido: sua versão divergente duplicava a migração já aplicada em `20261026173804`. Nenhuma migração histórica foi reexecutada durante a recuperação.

## 2. Auditoria de grants e correção aplicada

Consulta efetiva com `has_table_privilege` encontrou que `anon` e `authenticated` ainda tinham privilégios de INSERT/UPDATE/DELETE em `public.giras` e `public.perfis_admin`, além de SELECT. As políticas RLS limitavam a visibilidade, mas os grants excediam a necessidade de acesso.

Foi aplicada a migração `20261026175544_teu7vd_restrict_giras_profile_mutation_grants`, que revoga INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES e TRIGGER desses dois papéis nessas duas tabelas, preservando SELECT necessário para agenda pública e leitura do próprio perfil. O SQL também está versionado em `supabase/migrations/20261026175544_teu7vd_restrict_giras_profile_mutation_grants.sql`.

Para `reservas`, `auditoria` e `contadores_senha`, a consulta confirmou que `anon` e `authenticated` não possuem SELECT/INSERT/UPDATE/DELETE diretos. `service_role` mantém privilégios operacionais.

## 3. Políticas RLS encontradas

- `giras_publicadas_ou_admin_select`: agenda publicada para `anon/authenticated`; usuário com perfil ativo pode consultar giras conforme condição da política.
- `perfis_admin_select_self`: usuário autenticado consulta o próprio perfil.
- `reservas_admin_select`: somente perfil ativo com papel `admin` pode ler diretamente a tabela; a aplicação usa a API server-side para papéis com campos limitados.
- `auditoria_admin_select`: somente perfil ativo `admin` pode ler auditoria diretamente.
- `contadores_senha`: RLS habilitado sem políticas, intencional para manter o contador interno inacessível via acesso direto.

Todas as cinco tabelas auditadas têm RLS habilitado. Não foi criada política pública para silenciar o aviso informativo do contador.

## 4. Índices conferidos

Índices existentes observados:
- `giras_pkey`, `giras_chave_key`
- `reservas_pkey`, `reservas_gira_idx`, `reservas_ativas_por_gira_idx`
- `reservas_nome_idx`, `reservas_email_idx`
- `reservas_cancelada_por_idx`, `reservas_excluida_por_idx`, `reservas_reaberta_por_idx`
- `reservas_tipo_senha_unique`
- `perfis_admin_pkey`, `auditoria_pkey`, `auditoria_user_id_idx`, `contadores_senha_pkey`

O advisor de performance marcou seis índices como ainda não utilizados. Como o banco está vazio, isso não é evidência suficiente para removê-los; reavaliar depois de testes representativos.

## 5. Estado da base e alertas

- Contagens previamente verificadas: `giras=0`, `reservas=0`, `auditoria=0`, `contadores_senha=0`.
- Security Advisor: aviso informativo apenas para `contadores_senha` com RLS sem políticas.
- Edge Functions implantadas: nenhuma.
- Não houve importação de dados pessoais nem criação de reservas reais.
- As duas sobrecargas de `teu7vd_criar_reserva` continuam exigindo revisão de compatibilidade; não foram removidas.

## 6. Plano de homologação preparado

1. **Paridade de migrações:** conferir `supabase migration list` local/remoto e realizar `supabase db reset` apenas em banco local descartável, não no projeto remoto.
2. **Privilégios/RLS:** testar anon e authenticated sem token, perfil próprio, usuário sem perfil, perfil inativo e papéis admin/gestor/operador; confirmar que leitura/escrita direta de dados pessoais permanece negada.
3. **API de listagem:** token ausente/inválido, origem não autorizada, filtros/paginação, campos reduzidos para operador, ausência de DOB/telefone/email para operador.
4. **Criação:** Turnstile ausente/inválido, origem incorreta, payload inválido, data civil inválida, campos extras, duplicidade, lotação, corrida concorrente de senha, preferencial Outro sem descrição; sucesso sem expor senha/ID.
5. **Administração:** somente admin pode cancelar/reabrir/excluir; motivo obrigatório quando aplicável; vaga liberada após cancelamento; trilha de auditoria; falhas não retornam sucesso falso.
6. **Integridade:** testar sequências por tipo, limites de vagas e chamadas simultâneas; verificar ausência de duplicidade e idempotência no cliente após falha.
7. **Evidência:** usar contas e dados sintéticos, armazenar resultados HTTP/SQL sem dados pessoais reais; executar `supabase/tests/security-smoke.sh` só após configurar segredos e implantar em ambiente de homologação.
8. **Bloqueios prévios:** configurar `SUPABASE_SECRET_KEYS`, `TEU7VD_ALLOWED_ORIGIN` e `TURNSTILE_SECRET_KEY` no painel seguro; não colocar segredos no GitHub/frontend.

## 7. Critério de saída

Fase 13 concluiu a recuperação de SQL e correção de grants. **Ainda não declarar a aplicação homologada**: as Edge Functions não estão implantadas, os segredos não foram confirmados e o smoke test não foi executado. Manter site e criação de reservas reais desabilitados até concluir os testes e revisar a sobrecarga antiga de criação.

## Referência técnica

A documentação oficial do Supabase explica que os arquivos locais e a tabela remota `supabase_migrations.schema_migrations` são sistemas separados e devem ser reconciliados antes de `db push`: https://supabase.com/docs/guides/deployment/database-migrations
