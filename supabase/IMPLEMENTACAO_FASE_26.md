# Fase 26 — Implantação das Edge Functions em homologação

## Resultado
As três Edge Functions foram implantadas no projeto Supabase `ReservasSenhasTEU7VD` (`emwnytvlbpgiwqswojze`) e confirmadas como `ACTIVE`.

| Função | Versão | Verificação JWT na plataforma |
|---|---:|---|
| `criar-reserva` | 1 | Desativada, pois o endpoint público faz sua própria validação de origem, payload e Turnstile; falha fechada se não configurado |
| `listar-reservas` | 1 | Ativada |
| `admin-reservas` | 1 | Ativada |

## IDs das implantações
- `criar-reserva`: `c2db2709-3c2f-4281-90d2-f1264196b57c`
- `listar-reservas`: `1cb92b74-d42d-403d-bb31-8a9388e19e9f`
- `admin-reservas`: `3c478595-161b-4e63-b3b5-119267ee6e99`

## Controles preservados
- As funções administrativas exigem JWT válido na plataforma e também validam sessão e papel ativo no servidor.
- Nenhuma migration foi aplicada nesta fase.
- Nenhum segredo foi enviado ou alterado por esta operação.
- Não foram criadas reservas nem importados dados pessoais.
- A agenda pública e o formulário do site continuam desativados; o site institucional separado não foi alterado.

## Bloqueios antes de testes de integração
Os testes HTTP ainda dependem da configuração de segredos no painel Supabase:
- `TEU7VD_ALLOWED_ORIGIN`: origem exata autorizada para o frontend.
- `SUPABASE_SECRET_KEYS`: JSON contendo a chave `default` com a secret key do projeto; nunca publicar ou colocar no repositório.
- `TURNSTILE_SECRET_KEY`: segredo do Cloudflare Turnstile para a função de criação.

Não foi possível configurar esses segredos pelo conector disponível. Sem eles, as funções falham fechadas; a criação pública não pode completar reservas. Após a configuração, executar os smoke tests HTTP e testes de autorização com contas artificiais antes de qualquer ativação pública.

## Evidência
- As três funções foram retornadas pela API de gestão como `ACTIVE` na verificação posterior à implantação.
- Projeto Supabase: `https://supabase.com/dashboard/project/emwnytvlbpgiwqswojze/functions`
