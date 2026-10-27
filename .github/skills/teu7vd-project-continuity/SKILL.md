---
name: teu7vd-project-continuity
description: Retomar o projeto TEU7VD de reservas e homologação usando os conectores GitHub e Supabase já autorizados quando estiverem disponíveis, sem pedir repetidamente ao usuário que conceda os mesmos acessos.
---

# Skill: Continuidade do projeto TEU7VD

## Contexto persistente
- Repositório principal do portal de reservas: `dihjanssencoelho-svg/ReservasSenhasTEU7VD`.
- Repositório separado do site institucional: `dihjanssencoelho-svg/siteTEU7VD`. Não substituir nem modificar o site institucional ao trabalhar no portal de reservas.
- Projeto Supabase de reservas/homologação identificado: `emwnytvlbpgiwqswojze` (`ReservasSenhasTEU7VD`).
- Outro projeto Supabase conhecido: `dewkqykaicjprjugzcpc` (`Pontos TEU7VD`); não presumir que seja ambiente de homologação do portal.
- O usuário informa que já concedeu acesso ao GitHub e Supabase para realizar o trabalho e executar testes. **Verificar os conectores disponíveis e a autorização real no início; não pedir ao usuário para conceder novamente os mesmos acessos se estiverem ativos.** Se um conector não estiver disponível nesta sessão, explicar a limitação específica e continuar com o que for possível.

## Estado conhecido na retomada
- O site institucional original deve permanecer intacto.
- O portal de reservas é um repositório independente e a hospedagem planejada é GitHub Pages.
- O README declara que não foram importados registros de consulentes pelo repositório.
- A captura mais recente de homologação informa que a integração local falhou ao baixar a imagem Docker do PostgreSQL do Supabase por limite temporário do registro de imagens. Também informa que workflow de CI, migrações, testes e integração Docker foram verificados/corrigidos; o teste administrativo estava sendo planejado.
- Próximo passo: inspecionar o estado real do repositório, commits, workflows e testes; retomar os testes administrativos e as verificações independentes. Não repetir diagnósticos já comprovados como concluídos sem motivo.

## Regras operacionais
1. Usar GitHub e Supabase conectados quando disponíveis; verificar estado real antes de executar ações e relatar evidências concretas, não presumir sucesso.
2. Fazer inspeção read-only primeiro: repositório, branch/commit, arquivos, workflows, migrations, tabelas, Edge Functions, logs relevantes e avisos de segurança.
3. Manter o Supabase de produção intacto durante a homologação. Identificar o projeto de destino pelo nome e ID; não executar migrações, DDL, deploy de funções ou alterações de configuração em produção sem autorização explícita e confirmação do alvo.
4. Preferir ambiente local ou ambiente/branch de homologação. Não criar branches/projetos que possam gerar custos sem informar e obter consentimento conforme necessário.
5. Não importar os registros de consulentes (incluindo a planilha de 725 registros mencionada no README) até que regras, datas, duplicidades, capacidade, senhas e registros incompletos sejam validados e o usuário aprove a importação.
6. Nunca expor, registrar em logs ou gravar no frontend segredos, service-role keys, senhas ou valores de variáveis secretas. Chaves públicas podem ser usadas no frontend apenas conforme as políticas de segurança do Supabase e com RLS adequado.
7. Testar autorização administrativa, autenticação, criação/cancelamento de reservas, duplicidade, concorrência/numeração, limites de capacidade, integridade transacional/rollback e auditoria.
8. Se o pull da imagem Docker falhar por rate limit, preservar a evidência, tentar novamente de forma limitada ou verificar cache/alternativa de teste segura; continuar testes independentes. Não contornar limites com credenciais desconhecidas nem modificar produção para contornar o bloqueio.
9. Corrigir de forma cirúrgica, preservar evidências e backups existentes, evitar backups redundantes, validar novamente e avançar automaticamente pelas etapas seguras. Parar se houver ambiguidade estrutural, risco de segurança, perda de evidências ou possível impacto em produção.
10. Ao final de cada etapa, registrar: arquivos/commits afetados, comandos ou testes executados, resultados objetivos, bloqueios externos, pendências e próximo passo. Não declarar homologação aprovada sem resultados observáveis.
