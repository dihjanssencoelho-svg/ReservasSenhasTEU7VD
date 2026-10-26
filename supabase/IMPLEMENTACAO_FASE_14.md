# Fase 14 — Preparação dos testes de homologação

**Resultado:** preparação estática e auditoria adicional concluídas; testes HTTP ainda bloqueados por configuração/deploy e por um contrato de autorização das RPCs administrativas.

## 1. Estado confirmado

- Migrações remotas: 11, com os dez arquivos versionados da fase anterior e a migração adicional desta fase.
- Contagens verificadas agora: `giras=0`, `reservas=0`, `auditoria=0`, `contadores_senha=0`.
- Edge Functions implantadas: nenhuma.
- Nenhuma reserva ou dado pessoal de consulente foi criado/importado.

## 2. Correção de privilégio público

A auditoria identificou que o papel `anon` ainda possuía grant SQL de `SELECT` em `public.perfis_admin`, embora a política RLS não concedesse linhas ao papel anônimo. Para aplicar privilégio mínimo, foi aplicada `20261026181438_teu7vd_revoke_public_profile_select`, revogando SELECT de `anon` e mantendo a consulta do próprio perfil por `authenticated` conforme a política RLS. Arquivo correspondente versionado em `supabase/migrations/20261026181438_teu7vd_revoke_public_profile_select.sql`.

## 3. Bloqueador encontrado na revisão estática: RPCs administrativas

As Edge Functions `admin-reservas` e o SQL das RPCs administrativas não têm contrato compatível no estado atual:
- A Edge Function valida o JWT do usuário e o perfil `admin` usando um cliente privilegiado.
- Depois, chama `teu7vd_cancelar_reserva`, `teu7vd_reabrir_reserva` ou `teu7vd_excluir_reserva` através do mesmo cliente privilegiado `service_role`.
- As RPCs SQL exigem `teu7vd_is_admin()`, que determina o usuário por `auth.uid()`. Uma chamada feita com o contexto de `service_role` não representa automaticamente o JWT do administrador validado pela Edge Function; portanto, não se deve presumir que a mutação funcionará. Além disso, a auditoria SQL usa `auth.uid()` como responsável.

**Não implantar nem testar mutações reais até corrigir esse contrato.** A correção deve preservar a validação de JWT/perfil no servidor, garantir que somente a Edge Function confiável possa invocar a RPC, transportar a identidade validada do ator de forma não falsificável por clientes públicos e registrar o ator correto na auditoria. Não basta conceder EXECUTE a `authenticated` sem reavaliar o limite de segurança.

## 4. Matriz de homologação preparada

### A. Leitura pública e privilégio
1. `anon` pode ler somente giras ativas/publicadas.
2. `anon` não consegue consultar `perfis_admin`, `reservas`, `auditoria` ou `contadores_senha`.
3. `anon` e `authenticated` não conseguem escrever diretamente em tabelas protegidas.
4. `authenticated` lê apenas o próprio perfil.
5. JWT inválido/expirado e usuário sem perfil ativo recebem 401/403 conforme o contrato.

### B. Listagem administrativa
1. Origem incorreta → 403; token ausente/inválido → 401; payload malformado/campo extra → 400.
2. Admin, gestor e operador ativos conseguem consultar; perfil inativo/sem perfil é negado.
3. Operador nunca recebe data de nascimento, telefone, e-mail ou nome do médium.
4. Paginação, intervalo de datas, filtro de status, busca e giras acima de 500 devem ser testados. A implementação atual limita a consulta de giras a 500; precisa ser corrigida ou documentada antes de certificar escala completa.

### C. Criação de reserva — somente após configurar Turnstile e ambiente de teste
1. Origem/Turnstile inválido, payload grande, JSON inválido, campos extras, UUID/data inválidos → rejeição.
2. Preferencial inválido e `Outro` sem descrição → rejeição.
3. Gira não publicada/inativa, lotação, duplicidade e dados obrigatórios → rejeição sem duplicar.
4. Sucesso → mensagem genérica sem número de senha nem ID.
5. Chamadas concorrentes → não exceder vagas nem duplicar senhas; sequência independente por tipo.

### D. Administração — bloqueada até corrigir o contrato da seção 3
1. Somente admin ativo pode cancelar/reabrir/excluir.
2. Gestor, operador, sem perfil, perfil inativo e token inválido não podem mutar.
3. Motivo obrigatório em reabertura/exclusão; auditoria registra ator, instante, entidade e motivo sem dados pessoais desnecessários.
4. Cancelamento libera vaga; reabertura verifica capacidade e duplicidade; exclusão é lógica e preserva histórico.

## 5. Pré-requisitos de execução

- Configurar segredos pelo painel Supabase: `SUPABASE_SECRET_KEYS` (JSON com chave `default`), `TEU7VD_ALLOWED_ORIGIN` e `TURNSTILE_SECRET_KEY`.
- Criar usuários artificiais e perfis temporários para admin/gestor/operador e usuário sem perfil. Não reutilizar credenciais reais.
- Confirmar a URL/origem exata de homologação e o domínio autorizado no Turnstile.
- Fazer revisão e corrigir o contrato de autorização das RPCs antes de implantar `admin-reservas`.
- Implantar primeiro `listar-reservas` somente em ambiente de homologação após segredos e contas de teste; executar `supabase/tests/security-smoke.sh` com JWTs sintéticos.
- A função `criar-reserva` só deve ser implantada/testada com Turnstile configurado e uma gira de teste isolada; não publicar a agenda para consulentes.
- Não usar `db reset` nem `db push` no projeto remoto como teste. Usar banco local descartável para replay das migrações e comparar o esquema.

## 6. Critério de saída

Fase 14 preparou a matriz e encontrou um bloqueador real de integração entre Edge Function e RPCs administrativas. Não houve teste HTTP, compilação Deno ou mutação funcional, pois as funções não estão implantadas e segredos/contas não foram confirmados. A homologação continua **não aprovada**. O portal e as reservas reais permanecem desabilitados.
