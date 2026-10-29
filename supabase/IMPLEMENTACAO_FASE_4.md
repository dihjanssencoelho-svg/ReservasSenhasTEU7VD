# Implementação — Fase 4: redução da superfície de acesso privilegiado

Atualizado em 26/10/2026. Branch `preparacao-homologacao`.

## Correção aplicada
O advisor de segurança identificou que as RPCs administrativas de cancelamento, reabertura e exclusão lógica eram executáveis por `authenticated`. Mesmo com verificação interna do papel, mantê-las expostas no esquema público aumenta a superfície de ataque antes de haver painel administrativo homologado.

Foi aplicada a migração `teu7vd_restrict_admin_rpc_and_counter` e versionada em `supabase/migrations/20261026173500_teu7vd_restrict_admin_rpc_and_counter.sql`:
- Revogada execução de `teu7vd_cancelar_reserva`, `teu7vd_excluir_reserva`, `teu7vd_reabrir_reserva` para `public`, `anon` e `authenticated`.
- Revogada execução direta de `teu7vd_is_admin` para `public`, `anon` e `authenticated`.
- Revogado acesso direto à tabela `contadores_senha` para esses papéis.
- Operações administrativas podem ser chamadas somente por backend confiável usando `service_role`; o backend administrativo ainda deve ser implementado com autenticação real e autorização explícita por papel.

## Verificação posterior
Privilégios conferidos após a migração:
- `anon` executar cancelamento: false.
- `authenticated` executar cancelamento: false.
- `service_role` executar cancelamento: true.
- `authenticated` executar exclusão lógica, reabertura ou helper de administrador: false.
- Políticas RLS seguem sem permissões de escrita direta para usuários públicos.
- O advisor de segurança não mostra mais o alerta `authenticated_security_definer_function_executable`; resta apenas um aviso informativo de RLS habilitado sem política na tabela interna `contadores_senha`, que é intencional porque o acesso é feito por função de backend privilegiada.

## Bloqueios mantidos
- Edge Function de reserva continua versionada, não implantada.
- Cloudflare Turnstile, origem permitida e secrets ainda precisam ser configurados.
- Painel e backend administrativo ainda precisam ser implementados e testados com perfis reais.
- O portal não foi publicado e nenhum dado pessoal/histórico foi importado.
