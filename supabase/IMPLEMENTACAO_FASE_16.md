# Fase 16 — Endurecimento da criação pública e preparação de testes

**Resultado:** correções de tratamento de erro versionadas. Testes de execução ainda não realizados; esta fase não certifica homologação nem produção.

## Correções

1. A função `criar-reserva` agora trata exceções/rede indisponível na validação Turnstile como falha de validação. A criação não prossegue se a proteção antiautomação não puder ser confirmada.
2. Mensagens de erro retornadas pela RPC SQL não são mais encaminhadas diretamente ao navegador. Códigos conhecidos recebem mensagens controladas; erros inesperados recebem mensagem genérica e HTTP 503.
3. A mensagem de sucesso continua genérica e não revela número da senha nem identificador da reserva.

## Arquivo alterado

- [Edge Function criar-reserva](./functions/criar-reserva/index.ts)

## Validações e limites

- Revisão estática confirmou os novos blocos de tratamento de falha Turnstile e de mapeamento de erros.
- Não foi possível declarar compilação Deno, teste HTTP ou teste concorrente aprovado: as Edge Functions continuam sem implantação e não há contas sintéticas/segredos de homologação confirmados.
- Nenhuma reserva foi criada e nenhum dado pessoal foi importado.
- Antes dos testes, configurar no ambiente de homologação `SUPABASE_SECRET_KEYS`, `TEU7VD_ALLOWED_ORIGIN` e `TURNSTILE_SECRET_KEY`; usar apenas usuários e dados artificiais.
- O smoke test existente cobre a listagem administrativa, mas não cobre criação pública nem as operações administrativas. Expandir os testes funcionais com ambiente isolado antes de publicação.

## Próxima ação recomendada

Executar a compilação das três Edge Functions e os testes HTTP com contas artificiais, começando pela função somente leitura `listar-reservas`. Só depois avançar para testes de criação com Turnstile e mutações administrativas.
