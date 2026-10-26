# Fase 25 — Preparação de smoke tests HTTP sem mutações

## Objetivo
Preparar verificações de resposta HTTP para os três endpoints, sem criar, cancelar, reabrir ou excluir reservas.

## Implementação
- Criado `supabase/tests/edge-input-smoke.sh`.
- Os casos verificam rejeição de payload incompleto na criação, origem não autorizada e falta de autenticação nas funções protegidas.
- Os testes não fornecem token Turnstile válido nem JWT administrativo e devem ser interrompidos antes de qualquer RPC de mutação.
- Workflow passa a validar sintaxe Bash de `edge-input-smoke.sh` e `security-smoke.sh` com `bash -n`.

## Limitações
- O smoke test HTTP não foi executado porque as Edge Functions ainda não estão implantadas no ambiente de homologação.
- Não há deploy, alteração de secrets ou importação de dados nesta fase.
- Para executar testes autorizados de listagem e controles de função serão necessárias contas artificiais de homologação e tokens JWT válidos; esses testes devem ser realizados após a implantação controlada.
- As reservas públicas permanecem desativadas; o site institucional separado não foi alterado.

## Evidência relacionada
- Run 41, ID `40383800084`: os 10 testes de contrato e `deno check` das três Edge Functions passaram no commit `b89cac7506246261aba6d374ce403212052a9044`.
- O workflow foi ampliado em seguida para verificar a sintaxe dos scripts shell. A execução correspondente ao commit mais recente ainda não foi confirmada.
