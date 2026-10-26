# Requisitos funcionais — TEU7VD

Este documento registra as regras institucionais confirmadas para a migração do portal de reservas do Canva para a aplicação independente. Estas regras substituem limitações acidentais do código original. Não publicar nem liberar reservas reais antes dos testes de homologação.

## 1. Confirmação de reserva
- Em caso de sucesso, exibir uma mensagem de confirmação **sem apresentar o número da senha**.
- Em caso de falha, exibir uma mensagem clara de erro e permitir nova tentativa sem criar uma segunda reserva.
- A senha continua registrada no sistema e disponível conforme as permissões administrativas; apenas não deve aparecer na mensagem pública de sucesso.

## 2. Capacidade e quantidade de registros
- Não impor limite global artificial de 999 registros.
- A aplicação deve suportar o crescimento normal da base sem deixar de registrar reservas por causa de um limite fixo de registros.
- Se uma limitação técnica comprovadamente obrigatória exigir um teto, utilizar no mínimo 99.999 registros e comunicar a limitação; não usar 999.
- O limite de vagas por gira/data continua sendo uma regra operacional separada e deve ser validado no servidor/banco de forma transacional.
- Reservas canceladas não contam para a ocupação de vagas.

## 3. Cancelamento
- Somente administrador autenticado pode cancelar uma reserva.
- O cancelamento deve ser realizado no painel administrativo, nunca por ação pública do consulente.
- Após cancelamento confirmado, a vaga é liberada imediatamente.
- Registrar a ação em auditoria, incluindo responsável, data/hora e identificador da reserva, sem expor dados pessoais desnecessários.

## 4. Limite por pessoa e duplicidade
- O limite institucional é de uma reserva por pessoa.
- A validação deve ocorrer no servidor, não apenas no navegador, e ser protegida contra requisições simultâneas.
- O critério de identificação da pessoa e o escopo exato do limite (por gira/data ou global entre todas as giras) precisam ser definidos antes da implementação, para não bloquear indevidamente reservas legítimas nem permitir duplicidade.

## 5. Atendimento preferencial
- Valores oficiais permitidos: Gestante, Idoso, Criança de Colo, PCD e Outro.
- Se a pessoa indicar atendimento preferencial, exigir a seleção de uma dessas opções.
- Se selecionar Outro, permitir informar a descrição correspondente.
- Validar os valores no cliente e no servidor. Não inventar outros tipos sem aprovação.

## 6. Sequência de senhas
- A senha deve seguir sequência própria para cada tipo de gira.
- Não assumir uma sequência única global para todas as giras.
- A regra exata de sequência por tipo de gira (por exemplo, prefixo, numeração inicial, reinício e tratamento de senhas legadas) deve ser configurada e testada antes de liberar reservas.
- Preservar o número original de senha nos registros importados. Nunca renumerar silenciosamente dados históricos; conflitos devem ser apontados para revisão.

## 7. Administração e controle de acesso
- O painel administrativo exige autenticação real.
- Somente administrador autenticado pode cancelar, excluir ou reabrir registros.
- A exclusão e a reabertura devem exigir sessão administrativa válida, autorização no servidor e registro de auditoria.
- Não armazenar login/senha administrativa no JavaScript, HTML ou configuração pública.
- Aplicar políticas RLS e operações de escrita seguras no Supabase; não conceder permissão de escrita pública direta nas tabelas.
- Reabertura deve preservar o histórico e registrar motivo, responsável e data/hora. Exclusões devem ser controladas e auditáveis; preferir exclusão lógica quando possível.

## 8. Integridade, concorrência e privacidade
- Capacidade, duplicidade, alocação de senha e gravação devem ser protegidas no servidor/banco contra concorrência.
- Não expor a senha na mensagem pública de confirmação.
- Não registrar dados pessoais completos em logs técnicos.
- Manter importação e publicação bloqueadas até a homologação dos cenários de sucesso, falha, concorrência, cancelamento, reabertura, exclusão e permissões.

## 9. Migração do legado
- A planilha de origem permanece como fonte de referência para a migração histórica.
- Preservar a senha original e a referência à linha de origem.
- Não importar automaticamente registros com ambiguidades, dados incompletos ou senhas conflitantes sem revisão.
- Não versionar dados pessoais de consulentes no repositório GitHub.
