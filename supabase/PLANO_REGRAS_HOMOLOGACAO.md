# Plano de regras funcionais e homologação — TEU7VD

Este documento transforma as 12 regras aprovadas em critérios de implementação e aceite. O status descreve evidências no repositório em 27/10/2026; **"parcial" ou "pendente" não significa implementado nem homologado**.

## Regras e status

| # | Regra aprovada | Situação observada | Critério de aceite |
|---|---|---|---|
| 1 | Capacidade máxima, inclusive sob concorrência; exceção somente por formulário dentro do painel administrativo | Parcial: RPC pública bloqueia a criação quando lotada e bloqueia giras não publicadas. O formulário administrativo para excedentes ainda precisa ser criado. | A RPC pública nunca aceita excedente. Uma RPC separada exige usuário autenticado, perfil ativo e papel autorizado, registra motivo/ator e auditoria; só o formulário autenticado do painel chama essa RPC. Testar limite, duas chamadas simultâneas e override sem perfil (negado). |
| 2 | Senhas únicas e sequenciais sob concorrência | Parcial: contador transacional por tipo de gira e índice único por tipo/senha existem; testes de concorrência estão no workflow, mas o ambiente local não inicializou devido a erro do registry de imagens. | Executar 5 rodadas concorrentes; números únicos e consecutivos por tipo, sem lacunas causadas por rollback e sem reutilização inesperada após cancelamento/exclusão. |
| 3 | Duplicidade rejeitada no banco | Reforçada nesta etapa: índice único normalizado por gira, nome, nascimento, e-mail e telefone para reservas ativas/pendentes. Migração nova ainda precisa ser executada no Supabase local e homologada. | Testar duplicidade normal e concorrente; excluir logicamente ou cancelar não deve apagar o histórico nem permitir colisão com reservas ativas. |
| 4 | Auditoria e mutação na mesma transação | Parcial: criação e RPCs administrativas inserem auditoria na mesma transação SQL; teste de falha de auditoria está definido, mas ainda não executado com sucesso nesta execução. | Forçar falha de auditoria e confirmar rollback integral da reserva, contador e mudança administrativa. |
| 5 | Perfil e papel verificados no servidor em cada ação administrativa | Parcial: Edge Functions consultam token e perfil no servidor; funções SQL administrativas verificam papel admin. | Cada endpoint e RPC deve negar usuário ausente, inativo e papel insuficiente. Não confiar em papel enviado pelo navegador. |
| 6 | Preservar histórico de canceladas/excluídas | Implementado em parte: estados cancelada/excluída e campos de histórico existem; exclusão é lógica nas RPCs administrativas. | Verificar que nenhum fluxo público ou administrativo apaga fisicamente a reserva/auditoria e que reabertura respeita capacidade e duplicidade. |
| 7 | Agenda pública somente com giras explicitamente publicadas | Implementado na leitura pública: consulta filtra ativa=true e status=publicada. | Teste de integração garante que giras em validação, homologação ou inativas não aparecem nem aceitam reservas. |
| 8 | Exportação Excel, lista do dia e impressão | Pendente: não há evidência suficiente de implementação completa no portal Supabase atual. | Exportar somente o conjunto filtrado e autorizado; lista diária ordenada por senha; impressão sem botões/controles e com data/título. Respeitar permissões e minimizar dados pessoais. |
| 9 | Ocupação e alertas de poucas vagas | Parcial: a agenda mostra vagas previstas, não há confirmação de contagem de vagas restantes/percentual/alerta. | Calcular vagas restantes com reservas ativas; definir limiar configurável; estado esgotado consistente com a RPC de criação. Nunca usar contagem do cliente como controle de capacidade. |
| 10 | Importação e backup/restauração validados e auditados | Pendente: importação/backup não foram confirmados como recursos implementados nesta arquitetura. | Importação em prévia/staging, validação de esquema/linhas/duplicidade, relatório de rejeições, autorização administrativa e auditoria; backup versionado; restauração com prévia, idempotência, limite operacional e rollback. Não importar dados reais sem autorização explícita. |
| 11 | Aniversário na semana da gira | Pendente: não foi confirmada implementação atual. | Calcular em tempo de consulta usando nascimento e data da gira, inclusive virada do ano; não persistir derivação desnecessariamente; exportação deve usar a mesma regra. |
| 12 | Configurar mensagens e identidade visual pela interface administrativa | Pendente: não há evidência de painel completo para essas configurações. | Armazenar configuração em tabela controlada; só admin pode alterar; validar conteúdo/cores; auditar alterações; valores padrão seguros e renderização escapada. Nunca armazenar segredos ou senha administrativa nessa configuração. |

## Decisão especial: exceder capacidade

A exceção de capacidade é exclusivamente administrativa e não deve ser implementada como um booleano confiado ao frontend. O desenho aprovado é uma RPC administrativa separada, que valide token e perfil ativo no servidor/banco, exija motivo, registre o ator e a justificativa na auditoria e use transação. A RPC pública `teu7vd_criar_reserva` continua estritamente limitada à capacidade. O formulário de excedente fica dentro do painel autenticado; chamadas diretas sem perfil autorizado devem falhar.

O aceite deve esclarecer se o excedente ocupa a mesma senha sequencial por tipo de gira (recomendado: sim, sem duplicidade) e como os indicadores mostram vagas negativas/lotação excedida. A exceção não pode mudar o limite configurado nem tornar a gira publicamente aberta acima da capacidade.

## Regras de integridade já presentes no projeto

- O backend valida a origem, token Turnstile e conteúdo antes de criar uma reserva.
- A agenda pública filtra giras ativas e publicadas.
- O contador de senha e a reserva são atualizados na mesma transação SQL.
- A auditoria da criação está na transação da reserva.
- As RPCs administrativas preservam status/histórico em vez de apagar fisicamente.
- O acesso direto às tabelas é restrito por RLS/privilégios e as Edge Functions verificam perfil no servidor.

## Bloqueio de homologação atual

A execução do workflow de integração local falhou antes de executar os testes de banco porque o registry do container retornou `toomanyrequests` ao baixar imagens do Supabase. Os testes de criação, capacidade, numeração concorrente, auditoria, rollback, RLS e permissões permanecem **não homologados** até a execução real passar. Não contornar esse bloqueio desativando testes, não usar a base de produção como substituto e não declarar sucesso por verificações estáticas.

## Ordem de implementação recomendada

1. Executar a migração de duplicidade no Supabase local; tratar conflitos preexistentes sem apagar dados.
2. Completar e executar testes de banco para capacidade, concorrência, auditoria, rollback e papéis.
3. Criar RPC e formulário administrativo de excedente com motivo obrigatório e auditoria.
4. Implementar ocupação/alerta e, depois, lista do dia/exportação/impressão.
5. Implementar importação e restauração com staging e trilha de auditoria.
6. Implementar indicador de aniversário e interface de configurações.
7. Rodar a suíte completa e validar o frontend. Só depois considerar liberação pública.

Nenhuma regra deste documento autoriza publicar na branch `main`, alterar o site institucional separado, inserir dados pessoais reais ou modificar reservas em produção.
