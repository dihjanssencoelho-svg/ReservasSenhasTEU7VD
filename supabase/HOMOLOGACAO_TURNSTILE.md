# Matriz de homologação — Portal de Reservas TEU7VD

**Ambiente:** branch `preparacao-homologacao`  
**Estado:** testes preparados; execução ponta a ponta ainda pendente.  
**Segurança:** não usar dados reais, não criar reservas reais e não habilitar publicação/formulário durante esta etapa.

## Pré-condições

- [ ] Confirmar o hostname real do portal e que ele corresponde ao domínio permitido no widget Turnstile.
- [x] Usuário confirmou que `TURNSTILE_SECRET_KEY` e `TEU7VD_ALLOWED_ORIGIN` existem no Supabase Edge Function Secrets. **Pendente:** verificar os valores sem revelá-los e comprovar funcionamento por chamada de runtime.
- [ ] Usar apenas chaves de teste/ambiente de homologação quando houver suporte oficial; nunca substituir o segredo de produção por uma chave fictícia.
- [ ] Confirmar que o formulário HTML permanece desabilitado e que não houve importação de dados pessoais.
- [ ] Usar uma gira artificial de homologação, sem dados de consulentes.

## Testes negativos sem mutação

| ID | Cenário | Resultado esperado | Evidência |
|---|---|---|---|
| NEG-01 | Requisição sem cabeçalho Origin | HTTP 403 | Código/status e corpo genérico |
| NEG-02 | Origin diferente da origem permitida | HTTP 403 | Sem cabeçalho CORS autorizando a origem |
| NEG-03 | Método diferente de POST/OPTIONS | HTTP 405 | Mensagem genérica |
| NEG-04 | JSON malformado | HTTP 400 | Nenhuma gravação |
| NEG-05 | Corpo maior que 12.000 bytes | HTTP 413 | Nenhuma gravação |
| NEG-06 | Campo não reconhecido | HTTP 400 | Nenhuma gravação |
| NEG-07 | Campos obrigatórios ausentes | HTTP 400 | Nenhuma gravação |
| NEG-08 | Token Turnstile ausente/inválido/expirado | HTTP 403 | Nenhuma gravação |
| NEG-09 | Segredo Turnstile ausente ou provedor indisponível | Rejeição segura (fail closed) | Nenhuma gravação |
| NEG-10 | Listagem administrativa sem bearer token | HTTP 401 | Nenhum dado retornado |
| NEG-11 | Token expirado/inválido na listagem | HTTP 401 | Nenhum dado retornado |
| NEG-12 | Token válido sem perfil administrativo ativo | HTTP 403 | Nenhum dado retornado |
| NEG-13 | Ação administrativa sem autenticação | HTTP 401 | Nenhuma mutação |
| NEG-14 | Ação administrativa por papel diferente de admin | HTTP 403 | Nenhuma mutação |

## Testes positivos — somente com dados artificiais e ambiente controlado

| ID | Cenário | Resultado esperado | Condição |
|---|---|---|---|
| POS-01 | Turnstile válido + payload válido | Reserva criada e resposta genérica HTTP 201 | Só após aprovação explícita da janela de teste |
| POS-02 | Repetir a mesma pessoa na mesma gira/data | HTTP 409 | Confirmar regra de unicidade |
| POS-03 | Gira sem vagas/disponibilidade | Rejeição controlada | Confirmar que contador não ultrapassa o limite |
| POS-04 | Consulta por admin ativo | Dados compatíveis com o papel | Conta artificial autorizada |
| POS-05 | Consulta por operador | Sem data de nascimento, telefone, e-mail ou nome do médium | Conta artificial de operador |
| POS-06 | Cancelar/reabrir/excluir como admin | Operação auditada; reabertura exige motivo | Somente registros artificiais |
| POS-07 | Cancelamento de reserva | Vaga liberada imediatamente | Somente registros artificiais |

## Verificações de privacidade e integridade

- [ ] Resposta pública de sucesso nunca contém número da senha, UUID da reserva ou dados pessoais.
- [ ] Logs não registram nome, e-mail, telefone, data de nascimento, token Turnstile ou segredos.
- [ ] Não existe chave secreta/service-role no HTML, JavaScript ou repositório.
- [ ] Contadores e geração de senha são atômicos e separados por tipo de gira.
- [ ] Auditoria identifica ator, ação, motivo e data/hora nas ações administrativas.
- [ ] RLS e privilégios de tabela/RPC não permitem acesso público direto a reservas ou contadores.
- [ ] O site institucional separado permanece inalterado.

## Critério de aprovação

Não habilitar reservas públicas enquanto qualquer teste crítico estiver pendente ou falhar. A verificação de segredos no painel não substitui uma chamada real ao Turnstile. Não executar testes positivos que gravem dados até haver confirmação do ambiente artificial e autorização da janela de teste.

## Registro de execução

| Data | Teste | Resultado | Evidência/observação |
|---|---|---|---|
| 26/10/2026 | Inspeção de configuração e funções | Parcial | Usuário confirmou existência dos dois nomes de segredo; três funções estão ACTIVE na versão 3. Não foi possível confirmar valores nem executar chamada HTTP ponta a ponta. Logs recentes não provam validação Turnstile. |
