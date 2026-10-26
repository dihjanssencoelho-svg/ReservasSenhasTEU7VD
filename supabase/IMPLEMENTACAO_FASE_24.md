# Fase 24 — Testes automatizados do contrato de reserva

## Objetivo
Transformar as validações de entrada da Edge Function de criação de reservas em lógica pura reutilizável e coberta por testes automatizados, sem chamar Supabase, Turnstile ou serviços externos.

## Alterações
- Extraída a validação de campos, UUID, data real, e-mail, telefone, valores Sim/Não, retorno, nome do médium e atendimento preferencial para `supabase/functions/_shared/reservation-validation.ts`.
- A função `criar-reserva` agora usa o validador compartilhado antes de verificar Turnstile ou acessar o banco.
- Criada suíte `supabase/tests/reservation-validation.test.ts` com casos válidos e inválidos para campos desconhecidos, data inexistente, primeira vez fora do contrato, telefone inválido, retorno inválido, nome de médium incompatível, preferência sem tipo e tipo Outro sem descrição.
- Workflow `.github/workflows/edge-functions-check.yml` passa a executar `deno test supabase/tests/reservation-validation.test.ts` além de `deno check` das três Edge Functions.

## Segurança e escopo
- Testes usam dados sintéticos e não fazem requisições externas.
- Nenhuma Edge Function foi publicada; nenhuma migration foi executada; nenhum segredo foi configurado; nenhum dado pessoal foi importado.
- O site institucional separado permanece intocado e as reservas públicas continuam desativadas.

## Validação
- Execução local não realizada nesta etapa.
- GitHub Actions acionado pelo commit do workflow: run 28, ID `40383255504`. O resultado ainda precisa ser confirmado.
