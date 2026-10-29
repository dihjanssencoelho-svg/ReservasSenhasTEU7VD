# Fase 20 — Prontidão para homologação de integração

**Resultado:** revisão estática concluída; integração real bloqueada por pré-requisitos operacionais. Nenhuma implantação foi realizada.

## Revisões realizadas
- `criar-reserva`: valida origem, tamanho e estrutura do corpo, campos permitidos, datas/UUID/e-mail, preferência, Turnstile e respostas genéricas de erro. A verificação Turnstile falha de forma fechada se o serviço ou segredo não estiver disponível.
- `listar-reservas`: valida JWT com Supabase Auth e exige perfil ativo com papel permitido; reduz campos pessoais para operadores; paginação e filtros são validados.
- `admin-reservas`: exige JWT válido e perfil ativo `admin`; aceita somente ações conhecidas, valida identificador e motivo e envia o ID do ator às RPCs administrativas v2.
- `index.html`: o formulário público de reservas continua desativado; a interface informa que nenhum dado pessoal é coletado nesta etapa.

## Bloqueios antes de testes HTTP
1. Configurar e confirmar no painel Supabase os segredos necessários no ambiente de homologação. Nunca armazená-los no repositório ou no frontend.
2. Criar contas de teste artificiais no Supabase Auth e perfis correspondentes `admin`, `gestor`, `operador` e usuário sem perfil ativo.
3. Configurar a chave secreta do Cloudflare Turnstile no Supabase e uma site key pública no formulário quando a interface de reserva for implementada. Atualmente o formulário permanece desativado; não liberar criação de reservas sem integração completa do widget.
4. Confirmar o valor exato de `TEU7VD_ALLOWED_ORIGIN` correspondente à origem real usada na homologação.
5. Somente após esses itens, implantar as Edge Functions no projeto de homologação e executar o smoke test com dados sintéticos.

## Critérios mínimos de aceite
- Requisições sem token, com token inválido ou origem indevida são rejeitadas.
- Usuário sem perfil ativo recebe 403; papéis autorizados consultam apenas os campos previstos.
- Operador não recebe telefone, e-mail, data de nascimento nem nome do médium.
- Apenas admin executa cancelamento, reabertura e exclusão lógica; motivos obrigatórios quando aplicável e auditoria persistida.
- Criação pública só é habilitada após Turnstile válido, prevenção de duplicidade e teste concorrente do contador de senhas.
- Falhas não expõem mensagens SQL, chaves, tokens ou dados pessoais.
- Nenhum registro histórico é importado até a homologação do mapeamento e aprovação explícita.

## Estado
- Validação estática: aprovada na Fase 19.
- Testes HTTP reais: pendentes.
- Edge Functions implantadas: não confirmado / não realizado nesta fase.
- Reservas e dados pessoais importados: não.
- Publicação: bloqueada.
