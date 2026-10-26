# Fase 12 — Auditoria de contratos, privilégios e paridade de migrações

**Resultado: auditoria executada; implantação continua bloqueada.** Foram feitas leituras do repositório e consultas SQL somente de leitura no Supabase. Nenhum dado foi alterado.

## 1. Estado do ambiente confirmado

Consulta de contagens em 26/10/2026:
- `giras`: 0
- `reservas`: 0
- `auditoria`: 0
- `contadores_senha`: 0

O Supabase registra nove migrações:
- `20261026170140` — `teu7vd_initial_homologation_schema`
- `20261026170152` — `teu7vd_rls_performance_fixes`
- `20261026171938` — `teu7vd_transactional_reservations_admin`
- `20261026172001` — `teu7vd_normalize_identity_and_ticket_type`
- `20261026172101` — `teu7vd_admin_indexes_and_counter_privacy`
- `20261026172355` — `teu7vd_preferential_other_description`
- `20261026172531` — `teu7vd_restrict_internal_admin_helper`
- `20261026172645` — `teu7vd_restrict_admin_rpc_and_counter`
- `20261026173804` — `restrict_direct_reservation_table_access`

## 2. Divergência de migrações — bloqueio importante

A busca no branch `preparacao-homologacao` confirmou que os oito arquivos SQL históricos acima não estão presentes nos caminhos esperados em `supabase/migrations/`. O único arquivo de migração recuperado no repositório para esta sequência é `20261026190000_restrict_direct_reservation_table_access.sql`, mas a versão registrada no banco para a mesma migração é `20261026173804`.

Isso significa que não existe paridade comprovada entre histórico aplicado e arquivos versionados. **Não criei migrações históricas reconstruídas por inferência**, pois isso poderia representar incorretamente o estado do banco ou causar divergência em futuros ambientes. É necessário recuperar o SQL original confiável (histórico de commits, cópia local ou exportação do histórico de migrações) e versioná-lo corretamente antes de depender de reconstrução do projeto.

## 3. Privilégios das RPCs

Consulta a `pg_proc` e `has_function_privilege` confirmou:
- `teu7vd_criar_reserva` (sobrecargas com e sem descrição de preferencial): `anon=false`, `authenticated=false`, `service_role=true`.
- `teu7vd_cancelar_reserva`: `anon=false`, `authenticated=false`, `service_role=true`.
- `teu7vd_excluir_reserva`: `anon=false`, `authenticated=false`, `service_role=true`.
- `teu7vd_reabrir_reserva`: `anon=false`, `authenticated=false`, `service_role=true`.
- `teu7vd_is_admin`: `anon=false`, `authenticated=false`, `service_role=true`.

As funções verificadas são `SECURITY DEFINER` e têm `search_path` vazio, conforme esperado para funções privilegiadas que qualificam objetos. A função de criação tem duas sobrecargas; manter ambas documentadas e revisar a necessidade de remover a assinatura antiga somente após confirmar compatibilidade com todos os consumidores. Não foi feita nenhuma alteração SQL nesta fase.

## 4. Contratos das Edge Functions e interface

- `listar-reservas` aceita os status existentes no banco: `ativa`, `cancelada`, `pendente_validacao`, `excluida`.
- A listagem exige token válido e perfil ativo com papel `admin`, `gestor` ou `operador`; a seleção de campos do operador é reduzida.
- `admin-reservas` verifica o usuário no Supabase Auth e exige papel `admin` ativo antes de chamar as RPCs de mutação.
- `criar-reserva` exige origem autorizada e Turnstile válido; a função não revela número da senha nem identificador no sucesso.
- A interface mantém os botões de mutação bloqueados durante a homologação.

Essas conclusões são da revisão estática do código; não equivalem a testes de execução nem comprovam compilação.

## 5. Segurança e implantação

O Security Advisor continua retornando apenas o aviso informativo `rls_enabled_no_policy` para `public.contadores_senha`. A tabela interna não deve receber política pública apenas para silenciar esse aviso. Nenhuma Edge Function está implantada no projeto.

## 6. Próximos passos obrigatórios

1. Recuperar e versionar os oito arquivos de migração históricos originais e alinhar o nome/versão do nono arquivo com o registro aplicado, sem reaplicar DDL no banco atual.
2. Comparar definições de funções, índices, políticas e grants do banco com as migrações recuperadas.
3. Configurar origem autorizada, segredos e Turnstile no painel seguro.
4. Criar contas artificiais e preparar testes Deno/HTTP.
5. Implantar somente `listar-reservas` no ambiente de homologação e executar o script de smoke tests.
6. Só avançar para funções de mutação e criação após registrar evidências de testes.

**Não publicar, não importar a planilha histórica e não habilitar reservas reais** até resolver a paridade e concluir a homologação.
