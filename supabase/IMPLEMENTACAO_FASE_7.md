# Implementação — Fase 7: backend administrativo protegido

Atualizado em 26/10/2026. Branch `preparacao-homologacao`.

## Entrega versionada
A Edge Function `admin-reservas` foi criada em `supabase/functions/admin-reservas/index.ts` para servir como fronteira server-side para cancelar, reabrir e excluir logicamente reservas.

## Proteções
- Exige POST, origem exata configurada e token Bearer de Supabase Auth.
- Valida o token com Auth no servidor e resolve o perfil diretamente no banco com credencial server-side.
- Não confia em papel enviado pelo navegador.
- Exige perfil ativo com papel `admin` para as três ações privilegiadas, conforme os requisitos funcionais atuais.
- Valida campos, UUID e motivo para reabertura/exclusão.
- Não devolve SQL nem detalhes internos ao cliente; respostas não são armazenadas em cache.
- Usa chave secreta somente no ambiente da Edge Function. Nenhuma chave secreta está no frontend.

## Importante: ainda não implantada
A função está apenas versionada. Não foi implantada nem testada contra sessões reais. Antes de implantar, validar os nomes e argumentos das RPCs contra as funções existentes no banco, configurar `TEU7VD_ALLOWED_ORIGIN` e confirmar as chaves server-side. Não imprimir nem versionar valores secretos.

## Limites atuais
- Apenas ações de administrador estão implementadas nesta função. Gestor e Operador continuam sem backend de operações administrativas até aprovação e implementação de uma matriz de permissões.
- O painel de reservas, listagem protegida, edição de giras e gestão de usuários ainda não estão implementados.
- A tela de login do portal não deve ser considerada homologada só por autenticar e ler o próprio perfil.
- Não publicar o portal, habilitar reservas públicas ou importar dados pessoais nesta fase.

## Testes obrigatórios antes do deploy
1. Token ausente, inválido e expirado.
2. Perfil ausente/inativo e papéis gestor/operador: negar as três ações.
3. Admin autorizado: cada RPC com reserva de teste e motivo válido.
4. Origem inválida, método inválido, payload grande e campos extras.
5. Confirmar auditoria, cancelamento liberando vaga, reabertura preservando histórico e exclusão lógica.
