# Plano de regras funcionais e homologação — TEU7VD

Este documento transforma as 12 regras aprovadas em critérios de implementação e aceite. O status descreve evidências no repositório em 27/10/2026; **"parcial" ou "pendente" não significa implementado nem homologado**.

## Regras e status

| # | Regra aprovada | Situação observada | Critério de aceite |
|---|---|---|---|
| 1 | Capacidade máxima, inclusive sob concorrência; exceção somente por formulário dentro do painel administrativo | Implementado no código de branch: formulário exclusivo para admin, endpoint com autenticação/perfil, RPC separada exige motivo, lotação atingida e auditoria. A RPC pública não tem bypass. Homologação SQL pendente. | A RPC pública nunca aceita excedente. Uma RPC separada exige usuário autenticado, perfil ativo e papel autorizado, registra motivo/ator e auditoria; só o formulário autenticado do painel chama essa RPC. Testar limite, duas chamadas simultâneas e override sem perfil (negado). |
| 2 | Senhas únicas e sequenciais sob concorrência | Parcial: contador transacional por tipo de gira e índice único por tipo/senha existem; testes de concorrência estão no workflow, mas o ambiente local não inicializou devido a erro do registry de imagens. | Executar 5 rodadas concorrentes; números únicos e consecutivos por tipo, sem lacunas causadas por rollback e sem reutilização inesperada após cancelamento/exclusão. |
| 3 | Duplicidade rejeitada no banco | Índices únicos separados por e-mail e telefone normalizados, em conjunto com nome+nascimento+gira, para reservas ativas/pendentes. Migrações precisam ser executadas no Supabase local; conflitos preexistentes falham sem apagar dados. | Testar duplicidade normal e concorrente; excluir logicamente ou cancelar não deve apagar o histórico nem permitir colisão com reservas ativas. |
| 4 | Auditoria e mutação na mesma transação | Parcial: criação e RPCs administrativas inserem auditoria na mesma transação SQL; teste de falha de auditoria está definido, mas ainda não executado com sucesso nesta execução. | Forçar falha de auditoria e confirmar rollback integral da reserva, contador e mudança administrativa. |
| 5 | Perfil e papel verificados no servidor em cada ação administrativa | Parcial: Edge Functions consultam token e perfil no servidor; funções SQL administrativas verificam papel admin. | Cada endpoint e RPC deve negar usuário ausente, inativo e papel insuficiente. Não confiar em papel enviado pelo navegador. |
| 6 | Preservar histórico de canceladas/excluídas | Implementado em parte: estados cancelada/excluída e campos de histórico existem; exclusão é lógica nas RPCs administrativas. | Verificar que nenhum fluxo público ou administrativo apaga fisicamente a reserva/auditoria e que reabertura respeita capacidade e duplicidade. |
| 7 | Agenda pública somente com giras explicitamente publicadas | Implementado na leitura pública: consulta filtra ativa=true e status=publicada. | Teste de integração garante que giras em validação, homologação ou inativas não aparecem nem aceitam reservas. |
| 8 | Exportação Excel, lista do dia e impressão | Implementado parcialmente na branch: exportação CSV compatível com Excel para a página atual, filtros por intervalo de datas e impressão da listagem filtrada. Ainda não é arquivo XLSX nativo nem exportação de todas as páginas. | Exportar somente o conjunto filtrado e autorizado; lista diária ordenada por senha; impressão sem botões/controles e com data/título. Respeitar permissões e minimizar dados pessoais. |
| 9 | Ocupação e alertas de poucas vagas | Implementado no código de branch: RPC pública agregada sem dados pessoais retorna ocupadas, restantes, percentual e flag de poucas vagas com limiar configurável; frontend apresenta o indicador. Homologação SQL pendente. | Calcular vagas restantes com reservas ativas; definir limiar configurável; estado esgotado consistente com a RPC de criação. Nunca usar contagem do cliente como controle de capacidade. |
| 10 | Importação e backup/restauração validados e auditados | Implementado na branch: backup JSON admin-only e auditado; importação CSV com staging/prévia, limite de 5.000 linhas, mapeamento por gira_id, aplicação atômica e auditoria; restauração JSON com prévia e merge transacional sem apagar registros ausentes. Testes de banco pendentes. | Importação em prévia/staging, validação de esquema/linhas/duplicidade, relatório de rejeições, autorização administrativa e auditoria; backup versionado; restauração com prévia, idempotência, limite operacional e rollback. Não importar dados reais sem autorização explícita. |
| 11 | Aniversário na semana da gira | Implementado no painel admin e exportação da página: sinaliza aniversário até 6 dias antes/depois da data da gira, inclusive virada de ano. Precisa de teste de fronteira para 29/02. | Calcular em tempo de consulta usando nascimento e data da gira, inclusive virada do ano; não persistir derivação desnecessariamente; exportação deve usar a mesma regra. |
| 12 | Configurar mensagens e identidade visual pela interface administrativa | Implementado na branch: formulário admin para mensagens, cores hexadecimais e limiar de alerta; RPC verifica admin ativo e audita a alteração. A leitura pública usa RPC que retorna apenas configurações não secretas. Testes de banco pendentes. | Armazenar configuração em tabela controlada; só admin pode alterar; validar conteúdo/cores; auditar alterações; valores padrão seguros e renderização escapada. Nunca armazenar segredos ou senha administrativa nessa configuração. |

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


## Implementações incrementais adicionadas nesta branch
- `supabase/functions/admin-criar-excedente`: endpoint admin-only para cadastro acima da capacidade.
- `supabase/functions/admin-configuracoes`: configurações do portal verificadas e auditadas.
- `supabase/functions/admin-backup`: exportação JSON completa com auditoria e limites operacionais.
- `supabase/functions/admin-import-reservas`: importação em duas fases (prévia e aplicação).
- `supabase/functions/admin-restaurar-backup`: prévia e restauração JSON em merge, com motivo e confirmação explícita.
- Migrações novas para índices de duplicidade, RPC de excedente, métricas agregadas, configurações, restauração e importação.
- O frontend inclui alertas de vagas, sinalização de aniversário, exportação CSV para Excel, impressão, importação, backup/restauração e configurações administrativas.

**Limite importante:** esses artefatos estão na branch de homologação. Não afirmar que estão ativos no Supabase remoto até implantar as Edge Functions e aplicar as migrações de modo controlado. O CI ainda precisa concluir os testes estáticos e a integração local; nenhum dado de produção foi importado/restaurado por esta alteração.
