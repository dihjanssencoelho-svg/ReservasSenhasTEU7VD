# Fase 17 — Automação de validação estática

**Resultado:** pipeline de verificação estática versionado. Execução do pipeline ainda não confirmada; homologação permanece pendente.

## Implementação

Foi criado o workflow `.github/workflows/edge-functions-check.yml`, acionado em push para `preparacao-homologacao`, pull requests para `main`/homologação e execução manual. Ele instala Deno 2 e executa `deno check` separadamente para:
- `supabase/functions/criar-reserva/index.ts`
- `supabase/functions/listar-reservas/index.ts`
- `supabase/functions/admin-reservas/index.ts`

O workflow tem permissão de somente leitura no conteúdo do repositório e não implanta funções, não lê segredos e não modifica o Supabase.

## Limites

- O arquivo do workflow foi versionado; não há resultado de execução confirmado nesta etapa.
- Nenhuma Edge Function foi implantada.
- Nenhum teste HTTP, de concorrência, de mutação ou de integração foi executado.
- As tabelas de homologação continuam sem giras, reservas ou registros de auditoria.
- O próximo avanço depende de verificar a execução do workflow, resolver eventuais erros de compilação e configurar segredos/contas artificiais antes de testes HTTP.

## Segurança

Não colocar chaves Supabase, tokens de usuários ou credenciais de Turnstile em GitHub. Segredos devem ser configurados diretamente no ambiente de homologação pelo painel do Supabase. A publicação permanece bloqueada até os testes funcionais e de segurança serem aprovados.
