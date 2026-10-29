# Implementação — Fase 6: tela de acesso da equipe no próprio portal

Atualizado em 26/10/2026. Branch `preparacao-homologacao`.

## Entrega
- Adicionado ao portal o botão “Acesso da equipe” e formulário de login na própria aplicação.
- A autenticação utiliza Supabase Auth com a chave publishable pública, sem credenciais fixas no código.
- Após autenticação, a aplicação consulta apenas o perfil do próprio usuário em `perfis_admin` e exige perfil ativo com papel `admin`, `gestor` ou `operador`.
- Conta sem perfil, perfil inativo ou papel inválido não recebe acesso autorizado. A mensagem é genérica para não confirmar a existência de uma conta.
- O token é mantido em `sessionStorage` da aba atual e existe ação de logout.
- A área pública e o formulário de reserva continuam sem alteração de capacidade de gravação.

## Limite de segurança e homologação
Esta é uma primeira camada de autenticação/interface, não a conclusão do painel administrativo. A tela não mostra reservas nem permite criar, cancelar, reabrir ou excluir registros. O backend de operações administrativas ainda precisa validar sessão e papel no servidor antes de utilizar privilégios de serviço. A checagem de papel no navegador não deve ser considerada autorização suficiente para qualquer futura operação sensível.

## Testes pendentes antes de publicação
1. Login válido com cada papel.
2. Credencial inválida, usuário sem perfil, perfil inativo e papel inválido.
3. Sessão expirada, logout e falha de rede.
4. Verificar RLS e negar chamadas diretas às APIs para qualquer papel sem autorização.
5. Implementar backend administrativo seguro e homologar matriz final de permissões.

## Bloqueios mantidos
Portal não publicado; formulário público de reservas desativado; nenhuma importação de dados pessoais; painel operacional não liberado.
