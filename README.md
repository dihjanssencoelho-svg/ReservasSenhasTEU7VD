# TEU7VD — Portal independente de reservas de senhas

Este repositório é exclusivo do portal de reservas. **Não alterar nem substituir o site institucional**.

## Estado atual
- Branch de trabalho: `preparacao-homologacao`.
- Supabase configurado para homologação; seis migrações aplicadas.
- Nenhum consulente ou registro histórico foi importado.
- Frontend já consulta somente a agenda pública publicada; formulário segue desativado. Edge Function está versionada, mas não implantada. Portal não publicado.

## Arquivos principais
- `index.html`: entrada do portal.
- `assets/styles.css`: estilos e identidade visual.
- `assets/app.js`: lógica cliente, sem segredos.
- `supabase/schema.sql`: esquema inicial.
- `supabase/IMPORTACAO.md`: protocolo de migração dos registros históricos.
- `supabase/REQUISITOS_FUNCIONAIS.md`: regras institucionais confirmadas.
- `supabase/IMPLEMENTACAO_FASE_2.md`: estado das funções transacionais, permissões e testes executados.
- `supabase/IMPLEMENTACAO_FASE_3.md`: agenda pública, Edge Function preparada e pendências de homologação.
- `supabase/functions/criar-reserva/index.ts`: backend público preparado; requer secrets e não está implantado.
- `supabase/functions/README.md`: configuração e requisitos de implantação.

## Regras confirmadas
1. Uma reserva por pessoa por gira/data.
2. Sequência de senhas independente por tipo de gira, iniciando em 1.
3. Confirmação pública sem número da senha.
4. Sem limite artificial de 999 registros.
5. Somente administrador autenticado pode cancelar, excluir ou reabrir; as ações devem ser auditadas.
6. Cancelamento libera a vaga imediatamente.
7. Tipos preferenciais: Gestante, Idoso, Criança de Colo, PCD e Outro.

## Segurança
- Nunca colocar a chave `service_role` ou qualquer segredo no frontend.
- RLS habilitado nas tabelas.
- RPC de criação executável apenas por `service_role`, não por `anon` ou `authenticated`.
- O frontend lê a agenda publicada usando apenas chave publishable e RLS.
- A criação de reservas exige Edge Function com Turnstile e chave secreta server-side; essa função ainda não foi implantada.
- O acesso administrativo usa Supabase Auth e perfil ativo com papel `admin`.
- Não versionar dados pessoais de consulentes.

## Publicação
Não habilitar GitHub Pages nem liberar reservas até configurar Turnstile e secrets, implantar e testar a Edge Function, configurar usuário administrador real, implementar o formulário/painel e passar os testes de homologação.
