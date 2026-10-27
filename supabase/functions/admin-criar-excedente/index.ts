import { createClient } from "npm:@supabase/supabase-js@2";

const expectedOrigin = () => Deno.env.get("TEU7VD_ALLOWED_ORIGIN") ?? "";
const reply = (status: number, body: Record<string, unknown>, origin: string | null) => {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  if (origin && expectedOrigin() && origin === expectedOrigin()) headers.set("Access-Control-Allow-Origin", origin);
  return new Response(JSON.stringify(body), { status, headers });
};
function secretKey(): string | null {
  try {
    const parsed = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    return typeof parsed.default === "string" ? parsed.default : null;
  } catch { return null; }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validDate = (v: unknown) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00.000Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const allowed = expectedOrigin();
  if (req.method === "OPTIONS") return !allowed || origin !== allowed
    ? new Response(null, { status: 403 }) : reply(204, {}, origin);
  if (req.method !== "POST") return reply(405, { success: false, message: "Método não permitido." }, origin);
  if (!allowed || origin !== allowed) return reply(403, { success: false, message: "Origem não autorizada." }, origin);
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!match) return reply(401, { success: false, message: "Autenticação necessária." }, origin);
  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 6000) return reply(413, { success: false, message: "Solicitação muito grande." }, origin);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("bad payload");
    body = parsed as Record<string, unknown>;
  } catch { return reply(400, { success: false, message: "Solicitação inválida." }, origin); }
  const fields = new Set(["gira_id","nome_completo","data_nascimento","telefone","email","primeira_vez","preferencial","tipo_preferencial","descricao_preferencial","retorno","medium_nome","motivo_excedente"]);
  if (Object.keys(body).some(k => !fields.has(k))) return reply(400, { success: false, message: "Campos não reconhecidos." }, origin);
  const requiredStrings = ["nome_completo","telefone","email","primeira_vez","motivo_excedente"];
  if (requiredStrings.some(k => typeof body[k] !== "string" || !(body[k] as string).trim()) ||
      typeof body.gira_id !== "string" || !uuid.test(body.gira_id) || !validDate(body.data_nascimento) ||
      typeof body.preferencial !== "boolean") return reply(400, { success: false, message: "Confira os campos obrigatórios." }, origin);
  const reason = String(body.motivo_excedente).trim();
  if (reason.length < 5 || reason.length > 500) return reply(400, { success: false, message: "O motivo deve ter entre 5 e 500 caracteres." }, origin);
  if (String(body.nome_completo).trim().length > 180 || String(body.email).trim().length > 254 ||
      String(body.telefone).length > 32 || String(body.primeira_vez).length > 20) return reply(400, { success: false, message: "Um ou mais campos excedem o tamanho permitido." }, origin);
  if (body.preferencial && !["Gestante","Idoso","Criança de Colo","PCD","Outro"].includes(String(body.tipo_preferencial))) return reply(400, { success: false, message: "Tipo preferencial inválido." }, origin);
  if (body.preferencial && body.tipo_preferencial === "Outro" && !String(body.descricao_preferencial ?? "").trim()) return reply(400, { success: false, message: "Descreva o atendimento preferencial." }, origin);
  const url = Deno.env.get("SUPABASE_URL");
  const key = secretKey();
  if (!url || !key) return reply(503, { success: false, message: "Serviço administrativo não configurado." }, origin);
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await client.auth.getUser(match[1]);
  if (authError || !authData.user) return reply(401, { success: false, message: "Sessão inválida ou expirada." }, origin);
  const { data: profile, error: profileError } = await client.from("perfis_admin")
    .select("user_id,papel,ativo").eq("user_id", authData.user.id).maybeSingle();
  if (profileError) return reply(503, { success: false, message: "Não foi possível validar as permissões." }, origin);
  if (!profile || profile.user_id !== authData.user.id || profile.ativo !== true || profile.papel !== "admin")
    return reply(403, { success: false, message: "Somente administrador ativo pode cadastrar excedente." }, origin);
  const { data, error } = await client.rpc("teu7vd_criar_reserva_admin", {
    p_actor_id: authData.user.id,
    p_gira_id: body.gira_id,
    p_nome_completo: String(body.nome_completo).trim(),
    p_data_nascimento: body.data_nascimento,
    p_telefone: String(body.telefone).trim(),
    p_email: String(body.email).trim().toLowerCase(),
    p_primeira_vez: String(body.primeira_vez),
    p_preferencial: body.preferencial,
    p_tipo_preferencial: body.preferencial ? String(body.tipo_preferencial ?? "") : null,
    p_descricao_preferencial: body.preferencial ? String(body.descricao_preferencial ?? "") : null,
    p_retorno: String(body.retorno ?? ""),
    p_medium_nome: String(body.medium_nome ?? ""),
    p_motivo_excedente: reason,
  });
  if (error || data?.success !== true) return reply(400, { success: false, message: "Cadastro não concluído. Verifique a lotação, duplicidade e os dados informados." }, origin);
  return reply(201, { success: true, message: "Cadastro administrativo registrado com auditoria." }, origin);
});
