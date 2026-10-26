# Fase 15 — Correção do contrato administrativo e paginação

**Resultado:** correções versionadas e aplicadas ao banco de homologação. Ainda não é aprovação de produção: funções Edge não implantadas e testes HTTP/compilação ainda pendentes.

## Correções realizadas

1. Criadas RPCs administrativas v2 para cancelar, reabrir e excluir logicamente reservas. Recebem o UUID do ator validado pela Edge Function e verificam novamente no banco que o perfil continua ativo e com papel `admin`.
2. As RPCs v2 mantêm `SECURITY DEFINER`, `search_path` vazio e EXECUTE concedido exclusivamente a `service_role`; `anon` e `authenticated` não recebem permissão. As operações gravam o ator validado em `reservas` e `auditoria`.
3. A Edge Function `admin-reservas` agora chama as RPCs v2 e passa o ID obtido de `auth.getUser(token)`, nunca um ID enviado pelo cliente.
4. A Edge Function `listar-reservas` deixou de limitar silenciosamente a agenda às primeiras 500 giras. Consulta em páginas de 500, com teto explícito de 10.000 giras; acima desse teto, retorna erro claro em vez de resultados incompletos.
5. Nenhum dado pessoal foi importado e nenhuma reserva foi criada. A migração não apaga dados nem altera registros existentes.

## Arquivos

- [Migração SQL](./migrations/20261026181721_teu7vd_admin_rpc_actor_and_gira_pagination.sql)
- [Edge Function administrativa](./functions/admin-reservas/index.ts)
- [Edge Function de listagem](./functions/listar-reservas/index.ts)

## Limitações e próximos critérios

- A validação do papel na RPC limita o ator a administrador ativo; a Edge Function já aplica a mesma regra.
- As RPCs antigas foram mantidas para compatibilidade, mas a Edge Function passa a usar exclusivamente as versões v2.
- A função de listagem usa limite operacional de 10.000 giras; filtros por gira/tipo/data continuam recomendados em bases grandes.
- Não foram implantadas Edge Functions nem executados testes Deno/HTTP; a configuração de segredos e contas sintéticas ainda é pré-requisito.
- Antes da publicação: validar SQL em testes funcionais com dados sintéticos, confirmar auditoria/lotação/duplicidade, testar a matriz de papéis e executar o smoke test. Site público e criação de reservas permanecem desabilitados.
