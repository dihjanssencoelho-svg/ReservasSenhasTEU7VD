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
| 26/10/2026 | Integração frontend estática | Parcial — arquivos conferidos após commit | Widget e callbacks de sucesso/expiração/erro presentes na branch; token só fica em memória; botão e formulário permanecem desativados; nenhum envio a `criar-reserva`. Hostname publicado e execução real ainda não confirmados. |
| 26/10/2026 | Confirmação do recurso GitHub Pages | Não confirmado pelo conector | O usuário forneceu a URL do repositório `https://github.com/dihjanssencoelho-svg/ReservasSenhasTEU7VD`, que é o código-fonte, não o endereço de publicação. API/metadados de Pages não ficaram acessíveis pelo conector. URL presumida de projeto é `https://dihjanssencoelho-svg.github.io/ReservasSenhasTEU7VD/`, mas não foi confirmada como publicada. |
| 26/10/2026 | Carregamento do Turnstile no navegador | Não executado | Acesso ao site publicado não disponível no ambiente de execução. A presença do script/sitekey/callbacks foi confirmada somente no código da branch; não comprova carregamento visual nem os três estados em runtime. |
| 26/10/2026 | Requisições negativas à Edge Function | Não executado | O ambiente disponível não oferece executor HTTP POST arbitrário para a URL da Edge Function e a rede de execução local não resolve DNS externo. Nenhum código HTTP foi inventado e nenhuma chamada foi feita. Sem evidência de runtime, não avançar para envio de reservas. |
| 26/10/2026 | Conferência do README e workflow | Parcial | README de `main` registra hospedagem como planejada. O workflow existente na branch executa checks Deno/sintaxe, não implanta GitHub Pages nem faz smoke HTTP; a configuração real de Pages e o hostname publicado continuam sem evidência via conector. |
| 26/10/2026 | Revisão dos smoke tests versionados | Preparados, não executados | `supabase/tests/edge-input-smoke.sh` realiza apenas requisições com payload incompleto/origem inválida e endpoints protegidos sem token; não precisa de dados de consulentes nem deve criar registros. Execução real depende de um runner com rede e variáveis configuradas. |

| 26/10/2026 | Captura do usuário — Settings → Pages | Confirmado: Pages desativado | A captura mostra “O GitHub Pages está atualmente desativado” e Ramo = “Nenhum”. Logo, não existe site publicado via Pages nesse repositório neste momento. Não habilitar `main` sem revisão; a branch de homologação contém o widget, mas ainda não passou por testes de runtime. |

## Próxima execução automatizada

- A branch possui `.github/workflows/edge-functions-check.yml`, que executa testes unitários de validação, `bash -n` nos scripts smoke e `deno check` nas três Edge Functions.
- O workflow dispara em push para `preparacao-homologacao`; esta atualização documental serve para iniciar a verificação estática, sem implantar Pages, sem chamar endpoints de produção e sem criar reservas.
- Os smoke tests HTTP não foram executados por esta alteração. Eles exigem execução separada com rede e variáveis de ambiente de homologação.
- GitHub Pages permanece desativado conforme a captura do proprietário; não selecionar `main` nem promover o frontend antes dos resultados de CI e revisão.

| 26/10/2026 | Captura atualizada de Settings → Pages | Build iniciado; domínio requer confirmação | A captura mostra Pages configurado para branch `preparacao-homologacao` e pasta `/` com a mensagem de que o site está sendo construído. A seção “Domínio personalizado” exibe `dihjanssencoelho-svg.github.io`, que coincide com o domínio padrão da conta e pode conflitar com o site institucional. Não foi possível validar o portal em runtime por este conector. Não alterar/remover o domínio nem promover a `main` sem confirmar se esse valor está realmente salvo e se o site institucional usa esse domínio. |

| 26/10/2026 | Acesso ao portal publicado | Confirmado pelo usuário | O usuário confirmou que o endereço padrão `https://dihjanssencoelho-svg.github.io/ReservasSenhasTEU7VD/` abre o portal. Isso confirma acesso visual ao frontend; não comprova funcionamento do Turnstile, execução das Edge Functions ou aprovação dos testes de segurança. Domínio personalizado deve permanecer removido apenas deste repositório; site institucional não deve ser alterado. |

| 26/10/2026 | Endurecimento do CI | Commit `6a0d7f890d0139656738e3fa2e51945a0f1fe77` | Adicionada verificação `node --check assets/app.js` e verificações estáticas para garantir que o botão de reserva continue desabilitado, que o frontend não chame a Edge Function de criação e que o sitekey do Turnstile permaneça presente. A execução automática é disparada pelo push; o conector disponível não expõe a listagem geral dos runs para confirmar o resultado. |
