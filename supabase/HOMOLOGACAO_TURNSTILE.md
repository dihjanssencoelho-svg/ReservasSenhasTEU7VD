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

| 26/10/2026 | GitHub Actions — workflow 95 | APROVADO | Run `40393635764` concluiu com `success`. Job `Verificação estática Deno`: testes de contrato de validação, sintaxe do frontend, verificações para manter o envio público bloqueado, sintaxe dos smoke tests e `deno check` das três Edge Functions concluíram com sucesso. Evidência: https://github.com/dihjanssencoelho-svg/ReservasSenhasTEU7VD/actions/runs/40393635764. Isso valida testes estáticos/unitários, não substitui smoke HTTP nem homologação de runtime. |

| 26/10/2026 | Conferência das funções implantadas e logs recentes | Parcial | Supabase confirma `criar-reserva`, `listar-reservas` e `admin-reservas` ativas na versão 3. A consulta somente leitura aos logs das Edge Functions não encontrou eventos recentes associados a `criar-reserva` ou Turnstile; isso não comprova falha, apenas ausência de evidência de chamadas. Os testes HTTP negativos ainda precisam ser executados por runner com rede e variáveis de homologação; não foram feitas chamadas de mutação. |

## Correção de evidências — estado vigente em 26/10/2026

Este bloco prevalece sobre registros históricos anteriores que descrevem Pages como desativado, não publicado ou sem confirmação. Esses registros foram mantidos como histórico da sequência de configuração, não como estado atual.

- **Publicação frontend:** o proprietário confirmou que `https://dihjanssencoelho-svg.github.io/ReservasSenhasTEU7VD/` abre o portal. A confirmação prova apenas acesso visual ao frontend.
- **Escopo do domínio:** qualquer remoção/ajuste de domínio personalizado foi autorizada somente no repositório de reservas. O site institucional `siteTEU7VD` não deve ser alterado.
- **CI estático:** workflow 95 (`40393635764`) concluiu com sucesso; testes unitários de contrato, sintaxe JavaScript/Bash e verificações Deno passaram. Isso não é um teste HTTP das funções implantadas.
- **Backend:** as três Edge Functions estão ativas na versão 3. A existência dos nomes de segredo foi confirmada pelo proprietário, mas os valores não foram lidos nem devem ser compartilhados. Logs sem eventos recentes não comprovam sucesso nem falha do Turnstile.
- **Bloqueio de homologação:** testes HTTP negativos e autorização por papéis ainda não foram executados por um runner com rede e variáveis de ambiente. Testes positivos que gravem reservas permanecem fora do escopo até existir ambiente artificial confirmado e autorização explícita.
- **Estado de segurança:** o formulário público permanece desabilitado; não promover para `main`, não habilitar reservas e não importar dados pessoais enquanto os testes críticos de runtime estiverem pendentes.

| 26/10/2026 | Reforço da validação de payload | Implementado; CI disparado pelos commits `7b3adff` e `7e38085` | A validação compartilhada agora rejeita data de nascimento futura e descrição de atendimento preferencial acima de 300 caracteres mesmo quando o tipo informado não é `Outro`. Foram adicionados dois testes unitários para cobrir essas bordas. Aguardando execução do workflow para confirmar aprovação; nenhuma função implantada ou dado de banco foi alterado por esta mudança de código. |

| 26/10/2026 | CI após endurecimento da validação | APROVADO | GitHub Actions run `40394665112` (workflow 105) concluiu `success`. Job `Verificação estática Deno`: testes de contrato atualizados, sintaxe do frontend, bloqueio estático do envio público, sintaxe dos smoke tests e verificação das três Edge Functions passaram. Evidência: https://github.com/dihjanssencoelho-svg/ReservasSenhasTEU7VD/actions/runs/40394665112. Ainda não substitui os testes HTTP/runtime. |

| 26/10/2026 | Ampliação dos smoke tests HTTP negativos | Implementado; CI aprovado | Commit `91e53a809ee184d3aed84b9624885b934e7f0d07`. O script `supabase/tests/edge-input-smoke.sh` passou a cobrir método não permitido (GET), origem ausente, origem não autorizada, JSON malformado e campo desconhecido, além dos casos anteriores de payload incompleto e endpoints protegidos sem token. Workflow 110 (push) e workflow 111 (pull request) concluíram com sucesso; o build/deploy do Pages também concluiu com sucesso. Esses workflows validam sintaxe/testes estáticos e publicação do frontend, mas não executam as requisições HTTP dos smoke tests contra as funções Supabase. |

| 26/10/2026 | Smoke HTTP real — workflow 122 | APROVADO | Run `40398161037` concluiu com sucesso. Foram executados contra as Edge Functions implantadas os casos negativos de método/origem/payload, endpoints protegidos sem token e payload válido com token Turnstile deliberadamente inválido (esperado HTTP 403). Nenhuma reserva foi criada; os testes param antes da RPC de gravação. Evidência: https://github.com/dihjanssencoelho-svg/ReservasSenhasTEU7VD/actions/runs/40398161037. |

| 26/10/2026 | Smoke do portal em navegador real — workflow 122 | APROVADO | O Playwright abriu o portal publicado, confirmou HTTP 200, verificou que nome/gira/botão de reserva seguem desabilitados, disparou um evento submit programático sem chamada a `criar-reserva` e confirmou que a área da equipe inicia fechada. O teste foi ajustado para aguardar `domcontentloaded`, evitando timeout por recursos externos que mantêm conexões ativas. Evidência: https://github.com/dihjanssencoelho-svg/ReservasSenhasTEU7VD/actions/runs/40398161037. |

**Próximo bloqueio de homologação:** os testes de listagem por papéis (admin/gestor/operador/sem perfil) exigem JWTs de contas artificiais específicas. O script `security-smoke.sh` não foi executado por falta de evidência de que esses tokens de homologação estejam configurados no runner. Não inserir tokens reais no repositório. Testes positivos que criem/cancelem/reabram/excluam reservas continuam pendentes de ambiente artificial isolado e autorização explícita.

| 26/10/2026 | Revisão read-only do banco Supabase | APROVADO COM RESSALVA | Consulta somente leitura aos catálogos PostgreSQL do projeto. RLS habilitado em `giras`, `reservas`, `perfis_admin` e `auditoria`. `anon` não possui SELECT em `perfis_admin`; `reservas` e `auditoria` não exibem privilégios diretos para `anon`/ `authenticated`; RPCs de reserva/admin não permitem EXECUTE para esses papéis e permanecem executáveis por `service_role`. Políticas atuais: agenda publicada visível ao público; perfil próprio para usuário autenticado; listagem de reservas e auditoria restrita a admin ativo. Ressalva: `relforcerowsecurity=false` nas tabelas (RLS habilitado, mas não FORCE); avaliar necessidade de FORCE conforme funções SECURITY DEFINER/owner e política operacional. Nenhum dado pessoal foi consultado e nenhuma alteração foi executada.

## Registro incremental — 28/10/2026 — implantação administrativa controlada

### Edge Functions implantadas em homologação

Projeto Supabase: `emwnytvlbpgiwqswojze`. Foram implantadas/atualizadas somente no projeto de homologação, com `verify_jwt=true`:

| Função | Versão após implantação | Estado |
|---|---:|---|
| `admin-backup` | 1 | ACTIVE |
| `admin-import-reservas` | 1 | ACTIVE |
| `admin-restaurar-backup` | 1 | ACTIVE |
| `admin-configuracoes` | 2 | ACTIVE |
| `admin-giras` | 2 | ACTIVE |
| `admin-criar-excedente` | 3 | ACTIVE |

As funções `admin-criar-reserva`, `admin-reservas`, `listar-reservas` e `criar-reserva` já estavam ativas. Nenhuma função foi implantada no projeto Pontos TEU7VD nem em produção.

### Evidências sem mutação de reservas reais

- **CI/HTTP:** run [40769011862](https://github.com/dihjanssencoelho-svg/ReservasSenhasTEU7VD/actions/runs/40769011862) concluiu `success`; jobs de verificação estática, integração local com rollback, smoke HTTP sem mutações e smoke do navegador passaram. Foram adicionados testes negativos sem token para as funções administrativas.
- **Autorização SQL:** `anon` e `authenticated` não possuem EXECUTE nas RPCs de prévia de importação/restauração; `service_role` possui EXECUTE.
- **Importação:** a prévia de uma linha artificial com status `excluida` retornou sucesso e criou lote de staging. Nenhuma reserva foi inserida por essa prévia.
- **Restauração:** a prévia de backup artificial vazio foi aprovada; a aplicação do lote vazio foi concluída com zero giras, zero reservas e zero contadores restaurados. A auditoria registra o ator, motivo e modo `merge_sem_exclusao`. A contagem de reservas permaneceu em 2, sem incremento.
- **Auditoria de retorno:** a edição da reserva artificial anterior deixou evento de auditoria com `user_id` igual a `detalhes.actor_id`; a fixture foi excluída logicamente e a gira de teste desativada.

### Bloqueios ainda não aprovados

1. O smoke HTTP cobre requisições negativas e bloqueio por ausência de token; **não comprova o fluxo positivo do Turnstile com token real válido** nem a criação ponta a ponta no navegador.
2. A importação foi validada em prévia, mas **a aplicação positiva de uma linha artificial não foi executada**. Não considerar importação plenamente homologada.
3. O backup completo via endpoint autenticado ainda não foi executado com JWT de administrador artificial; o teste de restauração foi limitado a um backup vazio e seguro.
4. O ensaio de reversão operacional do frontend/backend não foi executado. O código de restauração do banco não substitui um plano de rollback de implantação.
5. Não promover a `main` nem liberar reservas públicas até que os pontos acima sejam comprovados. Não usar token pessoal, segredo de produção ou dados reais como substituto.



## Registro incremental — 28/10/2026 — continuação da homologação

- **CI do commit de evidências:** run [40769187483](https://github.com/dihjanssencoelho-svg/ReservasSenhasTEU7VD/actions/runs/40769187483) concluiu `success`. O run de pull request [40769196068](https://github.com/dihjanssencoelho-svg/ReservasSenhasTEU7VD/actions/runs/40769196068) também concluiu `success`. Os checks estáticos, smoke do portal, integração local com rollback e smoke HTTP negativo permaneceram aprovados.
- **Estado do lote de importação artificial:** o lote `607064f0-40bf-45f3-a814-f1506093ebd3` permanece em `validado`; consulta de homologação não encontrou reserva com a chave artificial de fixture. A tentativa de aplicar a RPC diretamente via SQL foi rejeitada com `Apenas administrador ativo pode aplicar importação`, apesar de o perfil de teste constar como admin ativo. Isso é coerente com a necessidade de executar a operação sob contexto autenticado válido, e **não** constitui aprovação do fluxo positivo. Nenhuma reserva foi criada por essa tentativa.
- **Backup autenticado:** revisão do código de `admin-backup` confirma autenticação Bearer, validação de usuário por `auth.getUser`, verificação de perfil admin ativo, exportação paginada das tabelas e evento de auditoria antes de devolver o payload. Isso é revisão estática; a chamada autenticada e o conteúdo de backup ainda não foram testados ponta a ponta.
- **Turnstile:** o código de `criar-reserva` falha de forma fechada quando o segredo está ausente, quando o Siteverify falha ou quando o provedor não retorna `success=true`. Nenhum token positivo real de teste foi obtido nesta execução; não se simulou nem se falsificou resposta positiva.
- **Reversão:** o workflow local confirma rollback de integração local, mas não houve reversão real de uma implantação Supabase/Pages. Não declarar rollback operacional completo.
- **Decisão:** homologação continua **BLOQUEADA PARA LIBERAÇÃO**. Próximas ações dependem de sessão JWT de uma conta administrativa artificial para testar os endpoints autenticados, token Turnstile positivo oficialmente emitido para o hostname de teste e ensaio controlado de reversão de implantação. Não promover `main`, não mesclar PR #1 e não habilitar o formulário público enquanto esses gates não passarem.
