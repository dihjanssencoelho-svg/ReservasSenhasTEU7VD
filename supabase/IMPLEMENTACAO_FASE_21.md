# Fase 21 — Auditoria de contrato e matriz de homologação

**Resultado:** revisão de contrato concluída; nenhum deploy, alteração de segredo, gravação no Supabase ou importação foi realizado.

## 1. Constatações da revisão

### Criação de reserva
- A função `criar-reserva` rejeita campos desconhecidos, corpos inválidos/grandes, origem não autorizada, datas impossíveis, UUID inválido, e-mail inválido, preferência sem tipo válido e `Outro` sem descrição.
- A verificação Turnstile falha de forma fechada quando o segredo está ausente ou o provedor falha.
- **Ponto a resolver antes de liberar reservas:** `primeira_vez` é validado apenas como string não vazia. O endpoint não restringe o conteúdo a um conjunto de valores oficiais. Confirmar no formulário legado e no contrato SQL quais são os valores aceitos (por exemplo, sim/não ou outro enum) e então aplicar a mesma enumeração no frontend, Edge Function e RPC.
- **Ponto a resolver antes de liberar reservas:** `retorno` e `medium_nome` têm verificação de tipo, mas não limite explícito de tamanho no endpoint. Definir limites compatíveis com as colunas e o formulário de origem; validar antes de chamar a RPC.
- **Ponto a resolver antes de liberar reservas:** o contrato de `telefone` verifica apenas tamanho máximo e não exige um conjunto mínimo de dígitos. Confirmar formatos aceitos para telefone nacional e adicionar validação sem rejeitar formatos legítimos.
- O formulário público segue desativado e não coleta nem grava dados nesta etapa.

### Administração e consulta
- `admin-reservas` valida JWT por Supabase Auth e exige perfil ativo `admin` no servidor; os papéis enviados pelo cliente não são confiados.
- `listar-reservas` permite consulta apenas para perfis ativos `admin`, `gestor` ou `operador`; a seleção do operador omite nascimento, telefone, e-mail e nome do médium.
- Ações administrativas enviam o ID autenticado do ator às RPCs v2. Os testes reais de auditoria e transições de estado ainda dependem de ambiente e contas sintéticas.
- A origem permitida é configurada por segredo de ambiente; não fixar um domínio por suposição. Confirmar a origem exata do host de homologação antes de configurar.

## 2. Matriz de testes de integração

Executar somente com contas e registros artificiais, após configurar os segredos no painel Supabase. Não utilizar dados reais de consulentes.

| Área | Cenário | Resultado esperado | Estado |
|---|---|---|---|
| Origem/CORS | OPTIONS da origem autorizada | 204 e CORS da origem exata | Pendente |
| Origem/CORS | Origem diferente ou ausente | Rejeição; sem execução da operação | Pendente |
| Autenticação | Sem token / token inválido / token expirado | 401 | Pendente |
| Autorização | Usuário sem perfil ativo | 403 | Pendente |
| Consulta | Admin e gestor ativos | Consulta autorizada com campos previstos | Pendente |
| Consulta | Operador ativo | Consulta sem nascimento, telefone, e-mail e nome do médium | Pendente |
| Consulta | Página inválida, data impossível, campo extra | 400; sem consulta de dados | Pendente |
| Administração | Gestor/operador tentam cancelar, reabrir ou excluir | 403; nenhuma mutação | Pendente |
| Administração | Admin cancela reserva sintética ativa | Estado cancelado e auditoria; vaga liberada | Pendente |
| Administração | Admin reabre cancelada com motivo válido | Estado ativo e auditoria; respeita capacidade e duplicidade | Pendente |
| Administração | Reabertura sem motivo / vaga cheia / duplicidade | Rejeição sem alteração parcial | Pendente |
| Administração | Exclusão lógica com motivo | Estado excluído, histórico preservado e auditoria | Pendente |
| Criação | Turnstile ausente, inválido ou indisponível | Rejeição fail-closed; nenhuma reserva criada | Pendente |
| Criação | Campo extra, corpo malformado, data impossível, UUID inválido | 400; nenhuma reserva criada | Pendente |
| Criação | Tipo preferencial inválido ou Outro sem descrição | 400; nenhuma reserva criada | Pendente |
| Criação | Reserva válida em gira publicada com vagas | 201 genérico; não retornar senha nem ID | Pendente |
| Criação | Reserva duplicada da mesma pessoa na mesma gira/data | Rejeição; sem segunda reserva | Pendente |
| Concorrência | Duas solicitações simultâneas para última vaga | No máximo uma reserva aceita; capacidade consistente | Pendente |
| Concorrência | Reservas simultâneas para mesma pessoa/gira/data | No máximo uma reserva ativa aceita | Pendente |
| Privacidade | Respostas de erro e logs | Sem SQL bruto, segredo, token ou PII desnecessária | Pendente |
| Histórico | Importação/migração | Sem importação até aprovação explícita do mapeamento | Bloqueado |

## 3. Critérios para encerrar a fase de integração

1. Resolver os três pontos de validação acima sem inventar valores de negócio.
2. Configurar os segredos no ambiente Supabase de homologação; nunca enviar valores secretos por chat ou versioná-los.
3. Criar usuários e perfis artificiais para admin, gestor, operador e usuário sem perfil ativo.
4. Confirmar a origem exata de homologação e configurar Turnstile completo (site key pública na UI futura e secret key no backend).
5. Implantar as funções apenas no ambiente de homologação e executar os testes HTTP e concorrentes.
6. Corrigir e repetir todos os testes que falharem; manter a reserva pública desativada até aceite integral.

## 4. Proteções mantidas

- Nenhuma Edge Function foi implantada nesta fase.
- Nenhum segredo foi lido, alterado ou registrado.
- Nenhuma reserva ou dado pessoal foi criado/importado.
- O site institucional separado não foi alterado.
- Publicação e abertura das reservas permanecem bloqueadas.
