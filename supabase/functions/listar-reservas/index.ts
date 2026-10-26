import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = () => Deno.env.get("TEU7VD_ALLOWED_ORIGIN") ?? "";
const headersFor = (origin: string | null) => {
  const h = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "Pragma": "no-cache",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  if (origin && allowedOrigin() && origin === allowedOrigin()) h.set("Access-Control-Allow-Origin", origin);
  return h;
};
const reply = (status: number, body: Record<string, unknown>, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: headersFor(origin) });

function secretKey(): string | null {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    return typeof keys.default === "string" ? keys.default : null;
  } catch { return null; }
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validDate = (s: unknown) => { if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d = new Date(s + "T00:00:00.000Z"); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; };

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const expectedOrigin = allowedOrigin();
  if (req.method === "OPTIONS") {
    if (!expectedOrigin || origin !== expectedOrigin) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: headersFor(origin) });
  }
  if (req.method !== "POST") return reply(405, { success: false, message: "Método não permitido." }, origin);
  if (!expectedOrigin || !origin || origin !== expectedOrigin) return reply(403, { success: false, message: "Origem não autorizada." }, origin);
  const auth = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!auth) return reply(401, { success: false, message: "Autenticação necessária." }, origin);
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return reply(400, { success: false, message: "Solicitação inválida." }, origin);
  }
  if (new TextEncoder().encode(rawBody).byteLength > 5000) {
    return reply(413, { success: false, message: "Solicitação muito grande." }, origin);
  }
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid body");
    body = parsed as Record<string, unknown>;
  } catch {
    return reply(400, { success: false, message: "Solicitação inválida." }, origin);
  }
  const allowed = new Set(["query", "gira_id", "status", "tipo_gira", "data_inicio", "data_fim", "page", "page_size"]);
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(k => !allowed.has(k))) {
    return reply(400, { success: false, message: "Campos não reconhecidos." }, origin);
  }
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (query.length > 100) return reply(400, { success: false, message: "Busca muito longa." }, origin);
  if (body.gira_id != null && (typeof body.gira_id !== "string" || !uuidPattern.test(body.gira_id))) return reply(400, { success: false, message: "Gira inválida." }, origin);
  if (body.status != null && !["ativa", "cancelada", "pendente_validacao", "excluida"].includes(String(body.status))) return reply(400, { success: false, message: "Status inválido." }, origin);
  if (body.tipo_gira != null && (typeof body.tipo_gira !== "string" || body.tipo_gira.length > 80)) return reply(400, { success: false, message: "Tipo de gira inválido." }, origin);
  if (body.data_inicio != null && !validDate(body.data_inicio)) return reply(400, { success: false, message: "Data inicial inválida." }, origin);
  if (body.data_fim != null && !validDate(body.data_fim)) return reply(400, { success: false, message: "Data final inválida." }, origin);
  if (body.data_inicio && body.data_fim && String(body.data_inicio) > String(body.data_fim)) return reply(400, { success: false, message: "Intervalo de datas inválido." }, origin);
  const page = Number.isInteger(body.page) ? Number(body.page) : 1;
  const pageSize = Number.isInteger(body.page_size) ? Number(body.page_size) : 25;
  if (page < 1 || page > 10000 || pageSize < 1 || pageSize > 100) return reply(400, { success: false, message: "Paginação inválida." }, origin);

  const url = Deno.env.get("SUPABASE_URL");
  const key = secretKey();
  if (!url || !key) return reply(503, { success: false, message: "Serviço de consulta não configurado." }, origin);
  const trusted = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: authError } = await trusted.auth.getUser(auth[1]);
  if (authError || !userData.user) return reply(401, { success: false, message: "Sessão inválida ou expirada." }, origin);
  const { data: profile, error: profileError } = await trusted.from("perfis_admin").select("user_id,papel,ativo").eq("user_id", userData.user.id).maybeSingle();
  if (profileError) return reply(503, { success: false, message: "Não foi possível validar as permissões." }, origin);
  if (!profile || profile.user_id !== userData.user.id || profile.ativo !== true || profile.papel !== "admin") {
    return reply(403, { success: false, message: "Acesso administrativo não autorizado." }, origin);
  }

  // Acesso interno simplificado: somente perfil admin ativo pode consultar reservas.
  const select = "id,gira_id,senha_original,senha_numero,nome_completo,data_nascimento,telefone,email,primeira_vez,retorno,medium_nome,preferencial,tipo_preferencial,descricao_preferencial,status,tipo_gira,origem,legado_importado,linha_origem,created_at,updated_at,cancelada_em,reaberta_em,excluida_em,exclusao_motivo";

  try {
    let giraQuery = trusted.from("giras").select("id,titulo,data_gira,tipo_gira");
    if (body.gira_id) giraQuery = giraQuery.eq("id", String(body.gira_id));
    if (body.tipo_gira) giraQuery = giraQuery.eq("tipo_gira", String(body.tipo_gira));
    if (body.data_inicio) giraQuery = giraQuery.gte("data_gira", String(body.data_inicio));
    if (body.data_fim) giraQuery = giraQuery.lte("data_gira", String(body.data_fim));
    // Paginação explícita evita omitir silenciosamente giras após o limite de 500.
    const giras: Array<{id: string; titulo: string; data_gira: string; tipo_gira: string | null}> = [];
    const batchSize = 500;
    const maxGiras = 10000;
    for (let offset = 0; offset < maxGiras; offset += batchSize) {
      const { data: batch, error: giraError } = await giraQuery
        .order("data_gira", { ascending: false })
        .range(offset, offset + batchSize - 1);
      if (giraError) return reply(503, { success: false, message: "Não foi possível consultar a agenda." }, origin);
      giras.push(...(batch ?? []));
      if (!batch || batch.length < batchSize) break;
      if (offset + batchSize >= maxGiras) {
        return reply(503, { success: false, message: "A agenda excede o limite operacional de consulta. Refine os filtros." }, origin);
      }
    }
    const giraIds = giras.map(g => g.id);
    if (!giraIds.length) return reply(200, { success: true, role: profile.papel, data: [], giras: [], page, page_size: pageSize, total: 0 }, origin);

    let q = trusted.from("reservas").select(select, { count: "exact" }).in("gira_id", giraIds);
    if (body.status) q = q.eq("status", String(body.status));
    if (query) { const safeQuery = query.replace(/[^\p{L}\p{N}\s-]/gu, " ").trim().replace(/\s+/g, " "); if (safeQuery) q = q.or("nome_completo.ilike.%"+safeQuery+"%,senha_original.ilike.%"+safeQuery+"%"); }
    const from = (page - 1) * pageSize;
    const { data, error, count } = await q.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
    if (error) return reply(503, { success: false, message: "Não foi possível consultar as reservas." }, origin);
    const titleById = new Map((giras ?? []).map(g => [g.id, g]));
    // Supabase JS infere ParserError quando a seleção dinâmica é uma união de strings.
    // Normalizamos apenas a camada de resposta; a consulta e as permissões permanecem inalteradas.
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    const safeData = rows.map(row => ({ ...row, gira: titleById.get(String(row.gira_id)) ?? null }));
    return reply(200, { success: true, role: profile.papel, data: safeData, giras: giras ?? [], page, page_size: pageSize, total: count ?? 0 }, origin);
  } catch {
    return reply(503, { success: false, message: "Consulta temporariamente indisponível." }, origin);
  }
});
