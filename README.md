# TEU7VD — Portal independente de reservas de senhas

Este repositório é exclusivo do portal de reservas. **Não alterar nem substituir o site institucional**.

## Estado inicial
- Repositório separado: `ReservasSenhasTEU7VD`
- Hospedagem planejada: GitHub Pages
- Banco pretendido: projeto Supabase separado para homologação
- Nenhum registro de consulente foi importado por este repositório
- Não liberar reservas reais até implementar e homologar as regras de capacidade, senhas e acesso

## Estrutura planejada
- `index.html`: página de entrada do portal
- `assets/styles.css`: estilos e identidade visual
- `assets/app.js`: lógica cliente, sem segredos
- `supabase/schema.sql`: esquema inicial a revisar no projeto de homologação
- `supabase/IMPORTACAO.md`: procedimento para migração validada da planilha

## Regras de segurança
1. Nunca colocar a chave `service_role` ou qualquer segredo no frontend.
2. Habilitar e revisar RLS em todas as tabelas.
3. Criar reserva através de função transacional no servidor, verificando disponibilidade, limite de vagas e senha.
4. Acesso administrativo via Supabase Auth; não guardar senha administrativa no JavaScript.
5. Não importar os 725 registros da planilha até revisar datas, limites, senhas repetidas e registros incompletos.
6. Testar primeiro em homologação e comparar totais antes de aprovar qualquer migração.

## Publicação
Quando a aplicação for implementada e revisada, habilitar GitHub Pages em **Settings → Pages**, branch `main`, pasta `/ (root)`. A publicação da página não significa que reservas estão liberadas.

## Próxima fase
Preparar os arquivos da aplicação e o esquema do banco; configurar o Supabase em homologação; portar as funcionalidades do aplicativo atual; executar testes de segurança, capacidade, administração e importação.
