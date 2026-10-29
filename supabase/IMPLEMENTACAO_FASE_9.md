# Fase 9 — Smoke tests de segurança da consulta administrativa

O script \`supabase/tests/security-smoke.sh\` executa apenas chamadas de leitura e casos negativos. Ele **não cria nem altera reservas**.

## Pré-requisitos
- Edge Function \`listar-reservas\` implantada em ambiente de homologação.
- \`TEU7VD_ALLOWED_ORIGIN\` configurada no backend com a origem exata do portal.
- Contas artificiais de teste e perfis ativos de admin, gestor e operador; mais uma conta autenticada sem perfil ativo.
- JWTs de teste fornecidos via variáveis de ambiente, sem gravá-los em arquivos ou no Git.
- \`curl\`; \`jq\` recomendado para verificar o payload reduzido do Operador.

## Execução
No terminal local, com as variáveis configuradas na sessão:
\`\`\`bash
bash supabase/tests/security-smoke.sh
\`\`\`

Variáveis requeridas: \`SUPABASE_URL\`, \`SUPABASE_PUBLISHABLE_KEY\`, \`TEU7VD_ALLOWED_ORIGIN\`, \`TOKEN_ADMIN\`, \`TOKEN_GESTOR\`, \`TOKEN_OPERADOR\`, \`TOKEN_SEM_PERFIL\`.

O script cobre token ausente/inválido, origem não autorizada, campos extras, paginação e data inválidas, listagem por papel e conta sem perfil. Ele não substitui os testes completos descritos em \`IMPLEMENTACAO_FASE_8.md\`, não prova a segurança de cancelamento/reabertura/exclusão e não deve ser executado contra produção.

## Bloqueios
A função não está implantada e não existem usuários de teste provisionados pelo projeto nesta etapa. Portanto, o script foi preparado, mas **não foi executado**. Não crie contas reais ou use dados de consulentes para contornar esse bloqueio.
