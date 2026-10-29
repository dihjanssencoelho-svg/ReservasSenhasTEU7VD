# Fase 8 — Consulta administrativa protegida e matriz de papéis

Data: 26/10/2026. Branch: `preparacao-homologacao`.

## Escopo entregue no repositório
- Edge Function `listar-reservas` somente leitura, versionada, ainda não implantada.
- Filtros por nome/senha, gira, tipo de gira, status e intervalo de datas; paginação com tamanho máximo de 100.
- A interface interna apresenta a listagem após autenticação e validação do perfil ativo.
- Ações Cancelar/Reabrir/Excluir permanecem desabilitadas no navegador, inclusive para Admin, até aprovação formal dos testes.
- Nenhum registro pessoal foi importado e nenhuma reserva foi criada para teste.

## Matriz provisória de permissões
| Papel | Consultar reservas | Campos de contato e nascimento | Cancelar/Reabrir/Excluir |
|---|---|---|---|
| Admin ativo | Sim | Sim | Proibido na UI até homologação; API de ações exige Admin |
| Gestor ativo | Sim | Sim | Negado no backend de ações |
| Operador ativo | Sim | Não: lista reduzida | Negado no backend de ações |
| Sem perfil / inativo | Negado | Não | Negado |
| Anônimo | Negado | Não | Negado |

A matriz é deliberadamente conservadora. Confirmar se Gestor realmente precisa visualizar contato e nascimento antes de liberar produção; se não, reduzir os campos.

## Controles implementados
- Exige POST, origem exata configurada e token Bearer.
- Confirma token via Supabase Auth e perfil ativo no servidor; papel não é confiado ao cliente.
- Usa chave secreta somente no backend e seleciona campos por papel.
- Allowlist de campos, validação de UUID/status/datas, busca limitada, paginação limitada.
- Respostas sem cache; erros não revelam SQL nem detalhes internos.
- Não executa mutações; botões de ação continuam bloqueados.
- A API usa credencial privilegiada após validar a identidade/perfil; por isso não deve ser implantada até completar testes de acesso e revisar a exposição de dados por papel.

## Plano obrigatório de testes de segurança (antes de deploy)
1. **Origem/CORS:** origem autorizada, origem não autorizada, Origin ausente, OPTIONS autorizado e negado.
2. **Autenticação:** sem token (401), token malformado (401), token inválido/expirado (401), token de usuário sem perfil (403), perfil inativo (403).
3. **Autorização por papel:** admin e gestor consultam; operador recebe apenas campos reduzidos; qualquer papel não reconhecido/inativo é negado. Confirmar que Gestor/Operador não conseguem chamar `admin-reservas`.
4. **Validação:** GET (405), JSON inválido, campos adicionais, consulta acima de 100 caracteres, UUID inválido, status/tipo inválido, datas inválidas, data inicial posterior à final, página/tamanho fora dos limites.
5. **Filtragem/paginação:** combinações de filtros, página vazia, limite máximo, busca por nome/senha, datas sem giras correspondentes; verificar total e que não há registros de outra gira no resultado.
6. **Privacidade:** Operador nunca recebe data de nascimento, telefone, e-mail ou nome de médium; nenhum token/chave/stack/SQL no corpo de erro; respostas sem cache.
7. **Ações sensíveis:** confirmar que botões estão disabled e que a API de mutação nega Gestor/Operador; não executar mutações reais. Para testar RPC de Admin, usar ambiente isolado e reservas artificiais aprovadas, nunca dados de consulentes.
8. **RLS/API direta:** anon/authenticated não conseguem consultar reservas via REST diretamente nem executar RPCs administrativas; conferir grants e políticas após cada migração.
9. **Auditoria:** só validar estrutura em leitura até existir ambiente de teste separado; operações reais permanecem bloqueadas.
10. **Homologação:** registrar request/response/status e evidência sem tokens, e-mails, telefones, datas de nascimento ou nomes reais.

## Limitações conhecidas / bloqueios
- A função `listar-reservas` não foi implantada nem testada em runtime.
- Requer `TEU7VD_ALLOWED_ORIGIN` e configuração server-side de `SUPABASE_SECRET_KEYS`; não versionar segredos.
- O formulário público de reservas continua desativado.
- A interface de login ainda não implementa renovação automática do token; ao expirar, deve solicitar novo login.
- A listagem de giras para filtrar é limitada a 500 resultados por consulta; antes de produção, definir estratégia de paginação se a agenda puder exceder esse volume.
- A segurança não é considerada homologada apenas porque o código está no GitHub.

## Fontes de referência
- Supabase — Securing Edge Functions: https://supabase.com/docs/guides/functions/auth
- Supabase — CORS: https://supabase.com/docs/guides/functions/cors
- Supabase — Auth: https://supabase.com/docs/guides/auth


## Verificações executadas no banco de homologação (26/10/2026)
- Aplicada a migração `20261026190000_restrict_direct_reservation_table_access`.
- Resultado SQL: `anon` e `authenticated` sem privilégio direto SELECT em `reservas` e `auditoria`.
- Resultado SQL: `anon` e `authenticated` sem EXECUTE nas RPCs de criação de reserva e cancelamento; a verificação anterior confirmou também que criação fica disponível apenas para `service_role`.
- Advisor de segurança: sem alertas de função SECURITY DEFINER executável por usuários não autorizados. Resta apenas INFO para `contadores_senha` com RLS e sem política, intencional porque é tabela interna e não deve ser acessada diretamente.
- A consulta de contagem anterior retornou zero giras, reservas, contadores e auditoria; não houve criação ou importação de dados.
- A listagem protegida e as funções administrativas continuam **não implantadas** (`list_edge_functions` retornou lista vazia). Logo, não foram possíveis testes HTTP em runtime de token, CORS, paginação e respostas por papel; esses testes permanecem bloqueadores para liberar a área.

## Resultado e decisão
**Aprovado apenas para continuar em homologação de código e permissões de banco. Não aprovado para produção.** A remoção de privilégios diretos é aplicada no banco, mas não foi feita tentativa de acesso com credenciais reais anon/authenticated via HTTP. O endpoint server-side ainda precisa de deploy controlado com variáveis secretas configuradas, usuários de teste autorizados por papel e execução do plano acima. Até lá, ações de mutação continuam desabilitadas e a reserva pública permanece desligada.
