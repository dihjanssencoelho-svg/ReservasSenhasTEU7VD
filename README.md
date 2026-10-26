# TEU7VD — Portal independente de reservas de senhas

Este repositório é exclusivo do portal de reservas. **Não alterar nem substituir o site institucional**.

## Estado atual
- Branch de trabalho: `preparacao-homologacao`.
- Banco Supabase ativo; migrações de aplicação existentes.
- Nenhum consulente ou registro histórico foi importado.
- Frontend consulta apenas a agenda pública publicada; formulário segue desativado.
- Três Edge Functions estão implantadas no projeto Supabase e ativas (versão 2): `criar-reserva`, `listar-reservas` e `admin-reservas`.
- Portal não foi publicado/liberado para reservas.

## Arquivos principais
- `index.html`: entrada do portal.
- `assets/styles.css`: estilos e identidade visual.
- `assets/app.js`: lógica cliente, sem segredos.
- `supabase/schema.sql`: esquema inicial.
- `supabase/IMPORTACAO.md`: protocolo de migração dos registros históricos.
- `supabase/REQUISITOS_FUNCIONAIS.md`: regras institucionais confirmadas.
- `supabase/functions/`: Edge Functions.
- `supabase/functions/README.md`: configuração e requisitos para homologação.

## Regras confirmadas
1. Uma reserva por pessoa por gira/data.
2. Sequência de senhas independente por tipo de gira, iniciando em 1.
3. Confirmação pública sem número da senha.
4. Sem limite artificial de 999 registros.
5. Somente administrador autenticado pode cancelar, excluir ou reabrir; ações auditadas.
6. Cancelamento libera a vaga imediatamente.
7. Tipos preferenciais: Gestante, Idoso, Criança de Colo, PCD e Outro.

## Segurança
- Nunca colocar chave secreta ou `service_role` no frontend.
- RLS habilitado nas tabelas.
- RPC de criação executável apenas por backend confiável.
- O frontend usa apenas chave publishable e RLS para ler a agenda pública.
- `SUPABASE_SECRET_KEYS` é fornecida automaticamente pelo Supabase às Edge Functions; não cadastrar um segredo personalizado com esse nome.
- `TEU7VD_ALLOWED_ORIGIN` e `TURNSTILE_SECRET_KEY` precisam ser definidos em Edge Function Secrets.
- O widget Turnstile ainda precisa ser criado no Cloudflare e integrado ao formulário; seu sitekey é público, mas a secret key deve permanecer apenas no servidor.
- Acesso administrativo exige Supabase Auth e perfil ativo com papel autorizado.
- Não versionar dados pessoais de consulentes.

## Bloqueios antes de liberar reservas
1. Confirmar o domínio/hostname definitivo do portal.
2. Criar o widget Turnstile para esse hostname e cadastrar a secret key no Supabase.
3. Configurar `TEU7VD_ALLOWED_ORIGIN` com a origem exata.
4. Integrar o sitekey e o token Turnstile ao formulário.
5. Executar smoke tests e homologação ponta a ponta com contas artificiais.
6. Configurar/verificar a conta administrativa autorizada.
7. Só então considerar publicação e habilitação do formulário.

Não habilitar GitHub Pages nem liberar reservas até que os bloqueios sejam resolvidos. O site institucional separado permanece intocado.
