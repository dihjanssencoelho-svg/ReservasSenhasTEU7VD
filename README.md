# TEU7VD — Portal independente de reservas de senhas

Este repositório é exclusivo do portal de reservas. **Não alterar nem substituir o site institucional**.

## Estado atual
- Branch de trabalho: `preparacao-homologacao`.
- Supabase configurado para homologação; cinco migrações aplicadas.
- Nenhum consulente ou registro histórico foi importado.
- Portal ainda não publicado e reservas reais permanecem bloqueadas até completar frontend, backend público protegido e homologação.

## Arquivos principais
- `index.html`: entrada do portal.
- `assets/styles.css`: estilos e identidade visual.
- `assets/app.js`: lógica cliente, sem segredos.
- `supabase/schema.sql`: esquema inicial.
- `supabase/IMPORTACAO.md`: protocolo de migração dos registros históricos.
- `supabase/REQUISITOS_FUNCIONAIS.md`: regras institucionais confirmadas.
- `supabase/IMPLEMENTACAO_FASE_2.md`: estado das funções transacionais, permissões e testes executados.

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
- O frontend público deverá chamar um backend/Edge Function com proteção contra abuso; não conectar diretamente a função de criação do banco ao navegador.
- O acesso administrativo usa Supabase Auth e perfil ativo com papel `admin`.
- Não versionar dados pessoais de consulentes.

## Publicação
Não habilitar GitHub Pages nem liberar reservas até concluir a Edge Function pública protegida, configurar usuário administrador real, implementar o frontend e passar os testes de homologação.
