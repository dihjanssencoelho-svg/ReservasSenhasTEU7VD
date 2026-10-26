import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = () => Deno.env.get("TEU7VD_ALLOWED_ORIGIN") ?? "";
const cors = (origin: string | null) => {
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
  return headers;
};
function respond(status: number, body: Record<string, unknown>, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: cors(origin) });
}
function getSecretKey(): string | null {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    return typeof keys.default === "string" ? keys.default : null;
  } catch { return null; }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const allowed = allowedOrigin();
  if (req.method === "OPTIONS") {
    if (!allowed || origin !== allowed) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (req.method !== "POST") return respond(405, { success: false, message: "Método não permitido." }, origin);
  if (!allowed || !origin || origin !== allowed) return respond(403, { success: false, message: "Origem não autorizada." }, origin);

  const authorization = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) return respond(401, { success: false, message: "Autenticação necessária." }, origin);

  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > 4000) return respond(413, { success: false, message: "Solicitação muito grande." }, origin);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return respond(400, { success: false, message: "Solicitação inválida." }, origin);
  }
  const allowedFields = new Set(["action", "reservation_id", "reason"]);
  if (Object.keys(body).some((key) => !allowedFields.has(key))) {
    return respond(400, { success: false, message: "Campos não reconhecidos." }, origin);
  }
  const actions = {
    cancel: "teu7vd_cancelar_reserva",
    reopen: "teu7vd_reabrir_reserva",
    delete: "teu7vd_excluir_reserva",
  } as const;
  if (typeof body.action !== "string" || !Object.hasOwn(actions, body.action)) {
    return respond(400, { success: false, message: "Ação inválida." }, origin);
  }
  if (typeof body.reservation_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.reservation_id)) {
    return respond(400, { success: false, message: "Identificador de reserva inválido." }, origin);
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (body.action !== "cancel" && (reason.length < 5 || reason.length > 500)) {
    return respond(400, { success: false, message: "Informe um motivo entre 5 e 500 caracteres." }, origin);
  }
  if (body.action === "cancel" && reason.length > 500) {
    return respond(400, { success: false, message: "O motivo deve ter até 500 caracteres." }, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = getSecretKey();
  if (!supabaseUrl || !secretKey) return respond(503, { success: false, message: "Serviço administrativo não configurado." }, origin);

  const trusted = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await trusted.auth.getUser(match[1]);
  if (userError || !userData.user) return respond(401, { success: false, message: "Sessão inválida ou expirada." }, origin);

  // Resolve authorization server-side; never trust a role supplied by the browser.
  const { data: profile, error: profileError } = await trusted
    .from("perfis_admin")
    .select("user_id,papel,ativo")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (profileError) return respond(503, { success: false, message: "Não foi possível validar as permissões." }, origin);
  if (!profile || profile.user_id !== userData.user.id || profile.ativo !== true || profile.papel !== "admin") {
    return respond(403, { success: false, message: "Você não tem permissão para esta operação." }, origin);
  }

  const rpc = actions[body.action as keyof typeof actions];
  const { data: changed, error } = await trusted.rpc(rpc, {
    p_reserva_id: body.reservation_id,
    p_motivo: reason || null,
  });
  if (error || changed !== true) {
    // Do not return SQL, schema, or implementation details to the browser.
    return respond(400, { success: false, message: "A operação não foi concluída. Confira o status da reserva e tente novamente." }, origin);
  }
  return respond(200, { success: true, message: "Operação concluída." }, origin);
});
