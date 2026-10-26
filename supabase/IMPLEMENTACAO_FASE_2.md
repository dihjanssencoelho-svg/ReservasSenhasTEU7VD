# Fase 2 — estado da implementação no Supabase

Projeto Supabase: `emwnytvlbpgiwqswojze` (homologação). Atualizado em 26/10/2026.

## Migrações aplicadas
1. `teu7vd_initial_homologation_schema` — tabelas iniciais com RLS.
2. `teu7vd_rls_performance_fixes` — políticas de leitura e otimização de verificações de autorização.
3. `teu7vd_transactional_reservations_admin` — campos de tipo de gira, senha numérica, histórico de cancelamento/reabertura/exclusão, contador por tipo e RPCs transacionais.
4. `teu7vd_normalize_identity_and_ticket_type` — normalização de telefones por dígitos, normalização do tipo da gira e ajuste da detecção de duplicidade.
5. `teu7vd_admin_indexes_and_counter_privacy` — índices de chaves estrangeiras administrativas e revogação de acesso direto ao contador.

## Regras técnicas implementadas
- Reserva criada dentro de função transacional e somente executável pela role `service_role`; execução direta por `anon` e `authenticated` foi verificada como negada.
- Mensagem de sucesso não contém o número da senha.
- A reserva exige gira ativa, publicada, com limite definido e tipo de gira configurado.
- Campos obrigatórios validados no banco; tipos preferenciais aceitos: Gestante, Idoso, Criança de Colo, PCD e Outro.
- A verificação de duplicidade é por gira, nome normalizado, data de nascimento e correspondência de e-mail **ou** telefone normalizados, entre reservas ativas/pendentes.
- A contagem de vagas considera apenas reservas `ativa`; cancelar altera o status para `cancelada`, liberando a vaga. Reabertura exige vaga disponível e motivo.
- Contador atômico de senhas separado por tipo de gira, iniciando em 1. O tipo é normalizado para minúsculas para impedir sequências duplicadas por diferença de caixa.
- Exclusão é lógica (`status='excluida'`), com motivo, responsável, horário e auditoria.
- RPCs administrativas exigem perfil ativo com papel `admin`; motivo obrigatório para reabrir/excluir.
- RLS continua habilitado; o contador não pode ser consultado ou alterado diretamente por `anon`/`authenticated`.

## Validação executada
- As cinco migrações constam no histórico do Supabase.
- Consulta de contagem confirmou zero giras, zero reservas e zero contadores; nenhum dado pessoal foi importado.
- Verificação de privilégios: `anon` não pode executar a RPC de criação; `authenticated` também não; `service_role` pode executá-la.
- Os advisors não apontaram alertas de desempenho críticos; índices novos aparecem como não utilizados porque o banco de homologação ainda está vazio.

## Pendências antes de publicar
1. Criar Edge Function/backend para chamar `teu7vd_criar_reserva` com validação de origem, rate limiting e proteção contra abuso. Não colocar `service_role` no frontend.
2. Configurar e testar usuário administrador real em Supabase Auth e perfil em `perfis_admin`.
3. Revisar os alertas do advisor sobre funções `SECURITY DEFINER`: as RPCs administrativas verificam o papel `admin` dentro da função, mas precisam de testes com usuários sem perfil, operadores e administradores.
4. Implementar o frontend contra as funções seguras e remover limite artificial de 999 registros.
5. Homologar testes concorrentes de capacidade e senha, cancelamento/liberação, reabertura, exclusão, duplicidade, RLS e auditoria.
6. Definir o procedimento de sincronização do contador com os números históricos quando a planilha for importada. Nunca renumerar senhas legadas silenciosamente.
7. Importação de consulentes continua bloqueada até revisão da planilha e dos registros com pendências.

## Limitações conhecidas
- O escopo de uma reserva por pessoa foi implementado por combinação normalizada de nome + nascimento + (e-mail ou telefone) na mesma gira. Como não existe identificador pessoal único, homologue casos de homônimos antes da publicação.
- O contador avança globalmente por tipo de gira; se a instituição precisar reiniciar a sequência por data/período, isso deve ser especificado antes de liberar reservas.
- A confirmação pública não revela a senha, mas a senha segue armazenada para uso interno autorizado.
