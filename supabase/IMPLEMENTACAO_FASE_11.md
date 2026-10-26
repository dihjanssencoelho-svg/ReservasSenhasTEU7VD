# Fase 11 — Endurecimento da validação das Edge Functions

**Status: alterações de código versionadas; revisão de execução pendente.** As alterações foram feitas no branch `preparacao-homologacao`. Nenhuma função foi implantada e nenhum teste HTTP foi executado contra o projeto.

## Alterações realizadas

### 1. Limite real de corpo da requisição

As funções abaixo agora leem o corpo como texto, medem o tamanho em bytes UTF-8 e rejeitam conteúdo acima do limite antes de interpretar JSON. Isso evita depender exclusivamente do cabeçalho `Content-Length`, que pode estar ausente:

- `listar-reservas`: máximo de 5.000 bytes.
- `criar-reserva`: máximo de 12.000 bytes.
- `admin-reservas`: máximo de 4.000 bytes.

As três também rejeitam JSON inválido, `null`, arrays e valores que não sejam objetos.

### 2. Data de nascimento civil

A função `criar-reserva` passou a verificar que a data, além de obedecer ao formato ISO `AAAA-MM-DD`, existe no calendário e volta exatamente à mesma data após a interpretação UTC. Assim, datas como `2026-02-30` são rejeitadas antes da chamada à RPC.

### 3. Tipos dos campos

Na função `criar-reserva`, campos opcionais textuais e `primeira_vez` têm validação de tipo, além das validações já existentes de campos permitidos, e-mail, UUID e preferência.

## Arquivos alterados

- `supabase/functions/listar-reservas/index.ts`
- `supabase/functions/criar-reserva/index.ts`
- `supabase/functions/admin-reservas/index.ts`

## Verificação realizada

Os três arquivos foram relidos pelo GitHub após os commits para confirmar que a leitura do corpo e o limite de bytes estão presentes; a validação de data civil foi confirmada na função de criação.

**Não foram executados** testes de compilação Deno, testes unitários, smoke tests HTTP nem testes funcionais no Supabase. A existência do código no GitHub não prova que as funções compilam ou funcionam em runtime.

## Bloqueios que permanecem

1. Configurar a origem autorizada e os segredos pelo painel seguro do Supabase.
2. Configurar Cloudflare Turnstile (chave pública no portal e segredo na função).
3. Criar contas artificiais de homologação e perfis controlados.
4. Resolver a paridade das nove migrações registradas no banco com o repositório.
5. Revisar a matriz de campos por papel e a paginação/filtros da função de consulta.
6. Implantar apenas `listar-reservas` em homologação e executar os smoke tests.
7. Corrigir quaisquer falhas antes de testar funções de mutação ou criação de reservas.

Nenhuma reserva ou dado pessoal foi criado ou importado. Não publicar nem habilitar reservas reais nesta fase.
