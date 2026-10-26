# Edge Functions TEU7VD — estado e configuração

As três Edge Functions foram consultadas no projeto Supabase `emwnytvlbpgiwqswojze` em 26/10/2026 e estavam `ACTIVE`, todas na versão 3: `criar-reserva` (`verify_jwt=false`), `listar-reservas` (`verify_jwt=true`) e `admin-reservas` (`verify_jwt=true`). Isso confirma o estado reportado pelo painel, mas não substitui testes HTTP de runtime nem comprova os valores dos segredos. O formulário público continua desativado e não há autorização para importar dados pessoais.

## Variáveis de ambiente

### Injetadas automaticamente pelo Supabase
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEYS`: dicionário JSON de chaves secretas, com a chave `default` quando configurada no projeto.

**Não crie um segredo personalizado chamado `SUPABASE_SECRET_KEYS`**: o prefixo `SUPABASE_` é reservado e o Supabase fornece essa variável automaticamente. O código das funções já lê `SUPABASE_SECRET_KEYS` e usa `default`.

O segredo personalizado `TEU7VD_SECRET_KEYS` não é lido pelo código atual e é desnecessário. Pode ser removido manualmente na página de Edge Function Secrets depois de confirmar que não é usado por outra função.

### Segredos personalizados necessários
- `TEU7VD_ALLOWED_ORIGIN`: origem exata do portal, por exemplo `https://<usuario>.github.io` **somente se esse for o domínio final confirmado**. Não inclua caminho como `/ReservasSenhasTEU7VD`, barra final, query string ou fragmento.
- `TURNSTILE_SECRET_KEY`: segredo privado do widget Turnstile criado no Cloudflare. Nunca colocar no HTML, JavaScript, GitHub ou nesta documentação.

## Turnstile: passos necessários antes de liberar reservas

1. Confirmar o hostname definitivo do portal e se o repositório será publicado no GitHub Pages ou em outro domínio.
2. No Cloudflare Dashboard → Turnstile, criar um widget do tipo Managed e autorizar apenas o hostname final.
3. Guardar o **sitekey** público para integração no frontend e cadastrar a **secret key** como `TURNSTILE_SECRET_KEY` em Supabase → Edge Functions → Secrets.
4. Definir `TEU7VD_ALLOWED_ORIGIN` com a origem exata e confirmar que corresponde ao cabeçalho `Origin` do portal.
5. Integrar o widget ao formulário e enviar o token de Turnstile para `criar-reserva`. A página atual não contém widget e o formulário segue intencionalmente desativado.
6. Executar os smoke tests sem mutações, testes com contas artificiais e homologação ponta a ponta antes de habilitar reservas.

O sitekey pode aparecer no frontend; a secret key nunca. A criação de widget requer acesso autenticado à conta Cloudflare. Não inventar nem reutilizar chaves de produção ou de teste para tráfego real.

## Endpoints implantados

- `criar-reserva`: valida origem, payload e token Turnstile; a verificação JWT do gateway está desativada porque o endpoint público faz validação própria e falha de forma segura sem configuração.
- `listar-reservas`: JWT obrigatório e verificação server-side do perfil/papel.
- `admin-reservas`: JWT obrigatório e exige perfil ativo `admin` no servidor.

## Restrições mantidas

- Não habilitar formulário público nesta etapa.
- Não importar a planilha histórica nem dados pessoais.
- Não criar reservas reais durante testes.
- Não alterar o site institucional separado.
- Não implantar código novo na branch `main` sem revisão e autorização específica.
