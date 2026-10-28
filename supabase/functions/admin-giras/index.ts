import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = () => Deno.env.get("TEU7VD_ALLOWED_ORIGIN") ?? "";

function respond(status: number, body: Record<string, unknown>, origin: string | null) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  if (origin && allowedOrigin() && origin === allowedOrigin()) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function secretKey(): string | null {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    return typeof keys.default === "string" ? keys.default : null;
  } catch {
    return null;
  }
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const expected = allowedOrigin();
  if (req.method === "OPTIONS") {
    if (!expected || origin !== expected) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    } });
  }
  if (req.method !== "POST") return respond(405, { success: false, message: "Método não permitido." }, origin);
  if (!expected || !origin || origin !== expected) return respond(403, { success: false, message: "Origem não autorizada." }, origin);

  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!token) return respond(401, { success: false, message: "Autenticação necessária." }, origin);

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 3000) throw new Error();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return respond(400, { success: false, message: "Solicitação inválida." }, origin);
  }

  const allowed = new Set(["titulo", "data_gira", "tipo_gira", "limite_vagas"]);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    return respond(400, { success: false, message: "Campos não reconhecidos." }, origin);
  }
  const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
  const tipo = typeof body.tipo_gira === "string" ? body.tipo_gira.trim() : "";
  const capacity = body.limite_vagas;
  if (titulo.length < 3 || titulo.length > 120 || !validDate(body.data_gira) ||
      tipo.length < 1 || tipo.length > 80 || !Number.isInteger(capacity) ||
      Number(capacity) < 1 || Number(capacity) > 10000) {
    return respond(400, { success: false, message: "Revise o nome, a data, o tipo e a quantidade de senhas (1 a 10.000)." }, origin);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = secretKey();
  if (!url || !key) return respond(503, { success: false, message: "Serviço administrativo não configurado." }, origin);

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return respond(401, { success: false, message: "Sessão inválida ou expirada." }, origin);

  const { data: profile, error: profileError } = await db
    .from("perfis_admin")
    .select("user_id,papel,ativo")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (profileError) return respond(503, { success: false, message: "Não foi possível validar as permissões." }, origin);
  if (!profile || profile.user_id !== auth.user.id || profile.ativo !== true || profile.papel !== "admin") {
    return respond(403, { success: false, message: "Somente administrador ativo pode cadastrar giras." }, origin);
  }

  const { data, error } = await db.rpc("teu7vd_criar_gira", {
    p_titulo: titulo,
    p_data_gira: body.data_gira,
    p_tipo_gira: tipo,
    p_limite_vagas: Number(capacity),
    p_actor_id: auth.user.id,
  });
  if (error || !data?.success || !data?.gira_id) {
    return respond(error?.code === "23505" ? 409 : 400, {
      success: false,
      message: error?.message || "Não foi possível cadastrar a gira.",
    }, origin);
  }
  return respond(200, data, origin);
});
