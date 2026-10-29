# Implementação — Fase 3: agenda pública e preparação do backend

Atualizado em 26/10/2026. Branch `preparacao-homologacao`.

## Entregas desta fase
- O frontend consulta o endpoint REST público do Supabase usando somente a chave publishable.
- A agenda exibe apenas giras com `ativa=true` e `status='publicada'`; títulos e demais valores são escapados antes de inserir no HTML.
- A interface continua sem solicitar dados pessoais e o formulário permanece desativado.
- A Edge Function `supabase/functions/criar-reserva/index.ts` foi versionada, mas **não foi implantada**.
- O backend valida método, origem, tamanho do payload, lista de campos, formatos, tipo preferencial e token Cloudflare Turnstile antes de chamar a RPC de reserva.
- A resposta pública da Edge Function é genérica: não expõe senha, ID da reserva ou detalhes internos.
- Foi adicionado `descricao_preferencial` no banco; para o tipo `Outro`, a descrição é obrigatória no banco e na Edge Function.
- O helper interno de verificação de administrador deixou de ser executável diretamente por `authenticated`.

## Testes realizados
- Teste transacional revertido: descrição para tipo `Outro` é salva quando presente e rejeitada quando ausente.
- Teste transacional revertido: senha inicial por tipo é 1.
- Verificação de privilégios: `anon=false`, `authenticated=false`, `service_role=true` para execução da RPC de criação.
- Contagem final confirmou zero giras, reservas, contadores e auditorias; testes não deixaram dados persistidos.
- Não há Edge Functions implantadas no projeto, portanto a criação de reservas ainda não está acessível pelo portal.

## Bloqueios restantes
1. Configurar Cloudflare Turnstile (site key no cliente e secret somente nos secrets do Supabase).
2. Confirmar origem/domínio definitivo do portal e cadastrar `TEU7VD_ALLOWED_ORIGIN` no Supabase.
3. Confirmar que o ambiente de Edge Functions contém `SUPABASE_SECRET_KEYS` e a chave padrão, sem expor o valor.
4. Implantar a Edge Function e testá-la em homologação com tokens válidos/inválidos e origens permitidas/não permitidas.
5. Adicionar rate limiting adicional antes de abrir reservas ao público.
6. Configurar um usuário administrador real e homologar as funções administrativas com perfis admin, gestor, operador e sem perfil.
7. Revisar os alertas restantes do advisor de segurança. Os avisos das funções administrativas `SECURITY DEFINER` exigem testes de autorização por papel antes da publicação.
8. Definir sincronização de sequência com senhas legadas antes de importar a planilha.

## Estado de publicação
Portal não publicado, formulário desativado e dados históricos não importados. O site institucional continua independente e não foi alterado.
