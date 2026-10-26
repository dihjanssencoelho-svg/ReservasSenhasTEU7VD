# Edge Function de reservas — implantação pendente

Código versionado em `supabase/functions/criar-reserva/index.ts`. **Ainda não foi implantado** e o formulário segue desativado.

## Motivo do bloqueio
A função foi construída para falhar de forma segura se não estiverem configurados:
- `TEU7VD_ALLOWED_ORIGIN`: origem exata permitida do portal após confirmar o domínio definitivo.
- `TURNSTILE_SECRET_KEY`: segredo do Cloudflare Turnstile.
- As chaves secretas padrão do Supabase, lidas de `SUPABASE_SECRET_KEYS` no ambiente da Edge Function.

Não inserir segredos em arquivos GitHub ou no JavaScript do navegador. Configure-os em Supabase Dashboard → Edge Functions → Secrets. O portal deve receber somente a chave publishable.

## Proteções implementadas no código
- Somente método POST; validação de origem e CORS.
- Limite de tamanho do payload e lista de campos permitidos.
- Validação de formatos e tipos preferenciais.
- Verificação do token Turnstile antes de executar a RPC.
- Chave secreta lida somente no ambiente server-side.
- Chamada à RPC transacional `teu7vd_criar_reserva`.
- Resposta pública genérica, sem número de senha, ID da reserva ou dados sensíveis.
- Mensagens de erro controladas para não expor detalhes internos do banco.

## Antes de implantar
1. Confirmar a URL/origem final do portal e cadastrar essa origem no Turnstile.
2. Criar o widget Turnstile e configurar a chave secreta no Supabase; a chave pública/site key será usada apenas no frontend.
3. Confirmar que `SUPABASE_SECRET_KEYS` existe no ambiente da função e contém a chave padrão esperada. Não copiar nem imprimir o valor.
4. Implantar com verificação JWT desabilitada somente porque a função faz sua própria validação por origem + Turnstile; não remover essas validações.
5. Fazer testes de chamadas sem captcha, captcha inválido, origem não permitida, campos inválidos, duplicidade, limite de vagas, e resposta sem senha.
6. Implementar rate limiting adicional no gateway/backend antes de abrir reservas ao público, se o tráfego/risco justificar; CORS não é autenticação e não impede clientes fora do navegador.

## Testes SQL da etapa
Foi executado teste transacional revertido para verificar:
- Reserva aceita com preferência `Outro` quando a descrição está presente.
- Descrição obrigatória para `Outro`.
- Senha inicial igual a 1.
- Resposta de banco sem campo `senha` ou `ticket`; a Edge Function remove também o ID interno da resposta pública.
Nenhum registro de teste permaneceu no banco.
