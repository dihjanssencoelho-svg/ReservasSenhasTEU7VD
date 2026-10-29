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
- A análise do log do primeiro CI identificou também uma expressão de e-mail com escape duplicado; corrigida no commit `0d1025d1b1c75c3ec3d53799b0d782dcbc187dba`.
- Primeira execução do GitHub Actions (run 28, ID `40383255504`) encontrou falhas nos testes: as expressões regulares foram inicialmente gravadas com escapes duplicados, e uma expectativa de teste não refletia a validação de campo obrigatório.
- Correção aplicada nos escapes e na expectativa dos testes nos commits `6dea0c0641c5655ca12293ef334d7f9a0fb7d12b` e `a6867ff5307ff3cb7314306a4ba48c7f3bce4a18`.
- A execução subsequente confirmou 10/10 testes de contrato aprovados, mas falhou em `deno check` de `criar-reserva` porque as variáveis normalizadas ainda eram referenciadas no RPC sem declaração local após a extração. Corrigido no commit `b89cac7506246261aba6d374ce403212052a9044`.
- O estado do workflow para esse último commit ainda não está disponível na consulta de CI; portanto, a verificação estática final permanece pendente. Execução local não realizada nesta etapa.
