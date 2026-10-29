# Fase 23 — Validação de retorno e telefone

## Alterações
- Edge Function: `retorno` aceita somente vazio/opcional, `Sim` ou `Não`.
- Telefone: após remover caracteres não numéricos, exige de 10 a 15 dígitos; mantém o limite bruto de 32 caracteres.
- Nome do médium: limite de 180 caracteres.
- Coerência: o nome do médium só é enviado ao RPC quando `retorno = Sim`; se retorno for `Não`, o nome é descartado.
- Migration adicionada com constraints para retorno, tamanho do médium, coerência retorno/médium e dígitos do telefone.

## Evidência de contrato
O formulário legado oferece `Sim`/`Não` para retorno e exibe o campo nome do médium quando retorno é `Sim`. Os limites de 180 caracteres e 10–15 dígitos são validações técnicas adotadas para o novo endpoint; devem ser confirmados contra o cadastro real na homologação antes de abertura pública.

## Arquivos
- `supabase/functions/criar-reserva/index.ts`
- `supabase/migrations/20261026194500_teu7vd_validate_return_phone_fields.sql`

## Estado
- Alterações gravadas na branch `preparacao-homologacao`.
- Não houve deploy nem execução da migration.
- Testes HTTP e CI dos novos commits ainda não confirmados.
- A migration usa `NOT VALID`: novas inserções/atualizações ficam sujeitas às constraints, mas dados históricos precisam ser auditados antes da validação integral.
- Reservas públicas continuam desativadas; nenhum dado pessoal foi criado ou importado.
