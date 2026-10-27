---
name: reservas-teu7vd-continuity
description: Continue development and homologation of ReservasSenhasTEU7VD using the connected GitHub and Supabase tools, preserving progress and production safety.
---

# ReservasSenhasTEU7VD — continuidade do projeto

## Acessos e contexto do usuário
- O usuário informa que já concedeu os acessos necessários ao GitHub e ao Supabase e quer que o assistente use as conexões existentes para inspecionar, testar e avançar sem pedir repetidamente os mesmos acessos.
- No início de cada sessão, verifique de forma read-only se as ferramentas/conectores estão disponíveis e identifique o repositório/projeto correto. Não presuma que um acesso está ativo só porque foi concedido anteriormente.
- Repositório identificado: `dihjanssencoelho-svg/ReservasSenhasTEU7VD`, branch padrão `main`.
- Projeto Supabase identificado: `ReservasSenhasTEU7VD`, ref `emwnytvlbpgiwqswojze`.
- O projeto Supabase `Pontos TEU7VD`, ref `dewkqykaicjprjugzcpc`, é um projeto separado; não o use para esta tarefa sem evidência clara de que é necessário.

## Estado de retomada registrado em 2026-10-27
- A última execução informou que a integração local falhou ao baixar a imagem Docker do PostgreSQL do Supabase devido a limite temporário do registro de imagens.
- A execução também relatou verificações/correções de workflow CI, migrações, testes e integração Docker.
- O teste administrativo estava sendo planejado; não presuma que tenha sido executado ou aprovado.
- Próximo passo: inspecionar estado atual do repositório e evidências recentes; executar o teste administrativo e validações independentes que não dependam do Docker. Depois, retomar a integração PostgreSQL local com retry/cache ou outra alternativa segura disponível, sem contornar controles de segurança.

## Regras de execução
1. Inspecione antes de alterar: branch, commits recentes, arquivos modificados, workflows e testes existentes. Evite repetir diagnósticos já documentados.
2. Execute primeiro verificações read-only e testes locais/CI que não alterem dados de produção.
3. Trate o Supabase de produção como intocável durante a homologação: não aplicar migrações, não alterar configurações, não publicar/substituir Edge Functions e não escrever ou apagar dados sem autorização específica para aquela ação.
4. Não importar dados de consulentes durante a homologação.
5. Não revelar nem registrar chaves secretas, tokens, senhas ou conteúdo sensível em logs, commits ou respostas. Nunca colocar service-role key no frontend/GitHub Pages; apenas chave publicável/anon pode estar no cliente, sujeita a RLS.
6. Validar autenticação e autorização administrativa, criação/listagem/cancelamento de reservas, numeração concorrente, limite de capacidade, prevenção de duplicidades, rollback transacional e auditoria.
7. Se o download da imagem Docker for limitado, registrar erro e horário; tentar novamente com intervalo razoável ou usar cache/alternativa já suportada pelo projeto. Não declarar testes de banco aprovados sem um PostgreSQL real de teste.
8. Ao final, informar exatamente o que foi executado, comandos/testes e resultados, o que foi alterado (com commits/links), falhas e bloqueios. Não alegar execução sem evidência.
9. Seguir automaticamente para a próxima etapa segura após testes bem-sucedidos. Parar diante de ambiguidade estrutural, perda de evidências, risco de segurança ou necessidade de tocar produção.
