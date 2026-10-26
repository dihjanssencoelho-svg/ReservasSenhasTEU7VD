# TEU7VD — Portal independente de reservas de senhas

Este repositório é exclusivo do portal de reservas. **Não alterar nem substituir o site institucional**.

## Estado inicial
- Repositório separado: `ReservasSenhasTEU7VD`
- Hospedagem planejada: GitHub Pages
- Banco: projeto Supabase separado para homologação
- Nenhum registro de consulente foi importado por este repositório
- Não liberar reservas reais até implementar e homologar as regras de capacidade, senhas e acesso

## Estrutura
- `index.html`: página de entrada do portal
- `assets/styles.css`: estilos e identidade visual
- `assets/app.js`: lógica cliente, sem segredos
- `supabase/schema.sql`: esquema inicial aplicado no Supabase, a evoluir por migrações
- `supabase/IMPORTACAO.md`: procedimento para migração validada da planilha
- `supabase/REQUISITOS_FUNCIONAIS.md`: regras institucionais confirmadas para o sistema

## Regras de segurança
1. Nunca colocar a chave `service_role` ou qualquer segredo no frontend.
2. Habilitar e revisar RLS em todas as tabelas.
3. Criar reserva através de função transacional no servidor, verificando disponibilidade, duplicidade, capacidade e sequência de senha.
4. Acesso administrativo via Supabase Auth; não guardar senha administrativa no JavaScript.
5. Não importar os 725 registros da planilha até revisar datas, limites, senhas repetidas e registros incompletos.
6. Testar primeiro em homologação e comparar totais antes de aprovar qualquer migração.
7. Cancelamento, exclusão e reabertura são ações administrativas autenticadas e auditáveis.
8. A confirmação pública de reserva não deve revelar o número da senha.
9. Não aplicar limite artificial de 999 registros; detalhes no documento de requisitos funcionais.

## Regras confirmadas
- Uma reserva por pessoa por gira/data.
- Cada tipo de gira tem sequência de senhas independente iniciada em 1.

## Publicação
Quando a aplicação for implementada e revisada, habilitar GitHub Pages em **Settings → Pages**, branch `main`, pasta `/ (root)`. A publicação da página não significa que reservas estão liberadas.

## Próxima fase
Implementar as regras documentadas em `supabase/REQUISITOS_FUNCIONAIS.md` e executar testes de segurança, capacidade, administração e importação. A regra por pessoa e a numeração inicial de cada tipo de gira já foram definidas.
