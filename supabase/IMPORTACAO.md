# Protocolo de importação — TEU7VD

Fonte de trabalho: planilha de validação criada a partir de **Backup 26-10 site reservas canva.xlsx**. O arquivo contém 725 linhas e 11 combinações de gira/data identificadas na análise inicial. Esses números devem ser reconferidos no arquivo final antes de importar.

## Não importar antes de homologar
- Confirmar título, data e limite de vagas de cada uma das 11 giras.
- Rever senhas repetidas por gira, registros idênticos/similares e os 3 nascimentos ausentes.
- Não excluir ou renumerar silenciosamente qualquer registro.
- Preservar o número de senha original e a referência à linha da planilha.
- Marcar ambiguidades para revisão manual.

## Fluxo proposto
1. Manter a planilha original em local protegido e não versioná-la neste repositório público.
2. Preparar CSV sem dados além dos necessários para o sistema.
3. Importar primeiro para ambiente Supabase de homologação.
4. Conferir total de linhas, total por gira, senhas originais e pendências.
5. Validar criação de reservas concorrentes, capacidade máxima, cancelamento e auditoria.
6. Obter aprovação antes de qualquer importação para um ambiente de produção.

## Dados pessoais
A planilha possui dados pessoais de consulentes. Não fazer upload da planilha para um repositório GitHub público, nem incluir dados individuais em logs, issues ou commits.
