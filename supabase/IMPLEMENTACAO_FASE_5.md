# Implementação — Fase 5: acesso administrativo pelo próprio portal

Atualizado em 26/10/2026. Branch `preparacao-homologacao`.

## Decisão funcional confirmada
O login de **Administrador, Gestor e Operador** será feito pela própria aplicação/portal de reservas do TEU7VD, em uma tela de acesso da equipe. Não será necessário entrar no painel do Supabase nem em um site administrativo de terceiros para usar o sistema.

A tela de acesso pertence ao portal de reservas e é distinta da área pública de consulentes. A existência de um link ou tela de login não concede acesso administrativo por si só.

## Regra de acesso
1. Visitante/consulente: pode consultar apenas a agenda publicada e, após homologação, solicitar reserva. Não pode visualizar nem abrir o painel administrativo.
2. Administrador, Gestor ou Operador: autentica-se na tela do próprio portal com Supabase Auth; o servidor valida também se existe perfil correspondente ativo e qual é o papel.
3. Sem sessão válida, perfil ausente/inativo ou papel não reconhecido: negar o painel e todos os dados/ações administrativas.
4. Ocultar a interface não é controle de segurança suficiente: todas as consultas e mutações administrativas precisam de autorização no servidor e políticas RLS coerentes com o papel.
5. Nenhuma credencial fixa pode ficar em HTML/JavaScript. Nenhuma chave secreta/service_role pode ser enviada ao navegador.
6. A sessão administrativa deve poder ser encerrada (logout); erros de login devem ser genéricos e não revelar se um e-mail existe.
7. O painel será exibido dentro do mesmo portal após a autenticação, com permissões distintas por papel. A matriz final de permissões deve ser homologada antes de ativar ações reais.

## Situação técnica verificada
- O arquivo atual `index.html` ainda não contém tela de login administrativa.
- O portal ainda mantém o formulário público desativado.
- Nenhuma Edge Function está implantada neste projeto.
- As RPCs administrativas estão restritas a `service_role`, portanto ainda não existe backend administrativo pronto para executar ações do painel.
- A tabela `perfis_admin` permite que um usuário autenticado leia apenas o próprio perfil; isso é útil para a verificação de papel, mas não substitui autorização server-side nas operações.
- Não há usuário administrativo real configurado ou validado nesta fase.

## Próximas entregas necessárias
1. Criar a tela de login dentro do portal, sem publicar o site.
2. Implementar validação de sessão e perfil ativo, com bloqueio explícito de consulentes e contas sem papel.
3. Definir e implementar backend seguro para operações administrativas, verificando token Supabase Auth e papel autorizado antes de usar `service_role`.
4. Implementar painel e permissões específicas de Administrador, Gestor e Operador.
5. Testar acesso anônimo, usuário comum, perfil ausente/inativo, cada um dos três papéis, sessão expirada, logout e tentativas de chamar APIs diretamente.
6. Só depois homologar o fluxo completo; manter reservas reais, importação histórica e publicação bloqueadas até então.

## Limite desta fase
Esta fase registra e fixa a decisão de produto e a verificação do estado atual. **Não declara que a tela de login já esteja implementada** e não habilita ações administrativas ou reservas reais.
