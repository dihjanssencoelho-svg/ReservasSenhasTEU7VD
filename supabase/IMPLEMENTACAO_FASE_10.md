# Fase 10 — Auditoria de prontidão para homologação

**Status: bloqueada antes da implantação de qualquer Edge Function.** Esta fase foi somente de leitura: não alterou o banco, não criou usuários, não criou reservas e não publicou o portal.

## 1. Estado confirmado do Supabase

Consulta realizada em 26/10/2026:

- Tabelas públicas encontradas: `giras`, `reservas`, `perfis_admin`, `auditoria` e `contadores_senha`.
- RLS habilitado nas cinco tabelas.
- Contagens observadas: 0 giras, 0 reservas, 0 registros de auditoria e 0 contadores.
- Nove migrações registradas no banco, entre `20261026170140` e `20261026173804`.
- Nenhuma Edge Function implantada.
- O Security Advisor apresentou apenas o aviso informativo `rls_enabled_no_policy` para `public.contadores_senha`. Esse é o desenho intencional para uma tabela interna sem acesso direto pelos papéis públicos; não criar política pública para eliminar o aviso.
- As verificações anteriores confirmaram que `anon` e `authenticated` não têm SELECT direto em `reservas` ou `auditoria`, nem EXECUTE nas RPCs de criação/cancelamento.

## 2. Bloqueios que precisam ser resolvidos antes da primeira implantação

1. **Segredos e origem permitida:** configurar no painel Supabase `TEU7VD_ALLOWED_ORIGIN` com a origem exata do portal de homologação e conferir a disponibilidade de `SUPABASE_SECRET_KEYS` padrão. Não registrar chaves em arquivos, commits ou mensagens.
2. **Proteção anti-bot:** configurar `TURNSTILE_SECRET_KEY` e obter/configurar a chave pública do Turnstile no formulário antes de habilitar a criação de reservas. A função de criação deve continuar falhando de forma segura sem essa configuração.
3. **Contas artificiais:** criar usuários exclusivos de teste para `admin`, `gestor`, `operador` e usuário sem perfil ativo. Não utilizar contas de consulentes nem dados reais.
4. **Paridade de migrações:** o banco registra nove migrações, mas a busca por seus nomes/versões no código do repositório não encontrou os arquivos históricos correspondentes. Antes de depender de reconstrução de ambiente, conferir `supabase/migrations/` no branch e recuperar/registrar a sequência completa a partir de fonte confiável, sem reaplicar DDL às cegas no projeto existente.
5. **Contrato de status:** a tabela `reservas.status` aceita `ativa`, `cancelada`, `pendente_validacao` e `excluida`; a Edge Function de listagem também aceita esses valores. Manter esse contrato sincronizado com os filtros da interface e com as RPCs.
6. **Testes HTTP:** executar `supabase/tests/security-smoke.sh` apenas depois de implantar a função de consulta e configurar as quatro contas artificiais/JWTs. O script ainda não foi executado.
7. **Validação de payloads:** antes de liberar o formulário público, adicionar/confirmar limite real do corpo lido (não depender apenas do cabeçalho `Content-Length`) e validação de data civil válida na função de criação, além do padrão textual ISO. Rejeitar tipos incorretos e conteúdo excedente antes de chamar a RPC.

## 3. Sequência segura proposta

1. Revisar os arquivos de migração do repositório e registrar a paridade com as nove migrações aplicadas.
2. Fazer a revisão estática final das três funções (`listar-reservas`, `criar-reserva`, `admin-reservas`) e dos contratos da interface.
3. Configurar secrets e Turnstile no projeto de homologação pelo painel seguro.
4. Criar usuários artificiais e perfis de teste.
5. Implantar **somente** `listar-reservas` primeiro.
6. Executar os testes negativos e por papel, guardar apenas resultados HTTP sem tokens nem dados pessoais, corrigir falhas e repetir.
7. Só depois testar as ações administrativas com reservas artificiais; por último testar criação com Turnstile.
8. Não importar a planilha histórica, não ativar reservas reais e não publicar até aprovação explícita da homologação.

## 4. Critério de saída

A Fase 10 só pode ser marcada como concluída quando os bloqueios 1–7 forem resolvidos com evidências reproduzíveis. Neste momento, a conclusão correta é **auditoria realizada; implantação ainda não autorizada pela prontidão técnica**.

## Referências

- [Script de testes de segurança](tests/security-smoke.sh)
- [Fase 9 — smoke tests](IMPLEMENTACAO_FASE_9.md)
- [Documentação Supabase — secrets de Edge Functions](https://supabase.com/docs/guides/functions/secrets)
- [Documentação Supabase — autenticação em Edge Functions](https://supabase.com/docs/guides/functions/auth)
