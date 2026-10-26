import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("TEU7VD_ALLOWED_ORIGIN") ?? "null",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function response(status: number, body: Record<string, unknown>, origin?: string | null) {
  const allowed = Deno.env.get("TEU7VD_ALLOWED_ORIGIN");
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  });
  if (allowed && origin === allowed) headers.set("Access-Control-Allow-Origin", allowed);
  headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return new Response(JSON.stringify(body), { status, headers });
}

async function verifyTurnstile(token: string, remoteIp: string | null): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return false; // fail closed until the owner configures the secret
  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp) form.set("remoteip", remoteIp);
  const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!result.ok) return false;
  const data = await result.json();
  return data.success === true;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const allowedOrigin = Deno.env.get("TEU7VD_ALLOWED_ORIGIN");

  if (req.method === "OPTIONS") {
    if (!allowedOrigin || origin !== allowedOrigin) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return response(405, { success: false, message: "Método não permitido." }, origin);
  if (!allowedOrigin || !origin || origin !== allowedOrigin) {
    return response(403, { success: false, message: "Origem não autorizada." }, origin);
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > 12000) return response(413, { success: false, message: "Solicitação muito grande." }, origin);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return response(400, { success: false, message: "Solicitação inválida." }, origin);
  }

  const allowedFields = new Set([
    "gira_id", "nome_completo", "data_nascimento", "telefone", "email",
    "primeira_vez", "preferencial", "tipo_preferencial", "descricao_preferencial", "retorno", "medium_nome",
    "turnstile_token",
  ]);
  if (Object.keys(body).some((key) => !allowedFields.has(key))) {
    return response(400, { success: false, message: "Campos não reconhecidos." }, origin);
  }

  const required = ["gira_id", "nome_completo", "data_nascimento", "telefone", "email", "primeira_vez", "turnstile_token"];
  if (required.some((key) => typeof body[key] !== "string" || !(body[key] as string).trim())) {
    return response(400, { success: false, message: "Preencha os campos obrigatórios." }, origin);
  }
  const name = (body.nome_completo as string).trim();
  const email = (body.email as string).trim();
  const phone = (body.telefone as string).trim();
  const dob = body.data_nascimento as string;
  if (name.length > 180 || email.length > 254 || phone.length > 32 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dob) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.gira_id as string)) {
    return response(400, { success: false, message: "Confira os dados informados." }, origin);
  }
  if (body.preferencial === true &&
      !["Gestante", "Idoso", "Criança de Colo", "PCD", "Outro"].includes(String(body.tipo_preferencial ?? ""))) {
    return response(400, { success: false, message: "Selecione um tipo de atendimento preferencial válido." }, origin);
  }
  if (body.preferencial !== true && body.preferencial !== false) {
    return response(400, { success: false, message: "Informe se necessita de atendimento preferencial." }, origin);
  }
  if (body.preferencial === true && body.tipo_preferencial === "Outro" &&
      (typeof body.descricao_preferencial !== "string" || !body.descricao_preferencial.trim() || body.descricao_preferencial.trim().length > 300)) {
    return response(400, { success: false, message: "Descreva a necessidade de atendimento preferencial (até 300 caracteres)." }, origin);
  }

  const remoteIp = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip");
  const captchaOk = await verifyTurnstile(body.turnstile_token as string, remoteIp);
  if (!captchaOk) return response(403, { success: false, message: "Não foi possível validar a proteção contra envios automáticos." }, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  let secretKey: string | undefined;
  try {
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    secretKey = secretKeys.default;
  } catch {
    secretKey = undefined;
  }
  if (!supabaseUrl || !secretKey) {
    return response(503, { success: false, message: "O serviço de reservas ainda não foi configurado." }, origin);
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.rpc("teu7vd_criar_reserva", {
    p_gira_id: body.gira_id,
    p_nome_completo: name,
    p_data_nascimento: dob,
    p_telefone: phone,
    p_email: email,
    p_primeira_vez: body.primeira_vez,
    p_preferencial: body.preferencial,
    p_tipo_preferencial: body.preferencial ? body.tipo_preferencial : null,
    p_retorno: typeof body.retorno === "string" ? body.retorno : null,
    p_medium_nome: typeof body.medium_nome === "string" ? body.medium_nome : null,
    p_descricao_preferencial: typeof body.descricao_preferencial === "string" ? body.descricao_preferencial : null,
  });

  if (error) {
    const message = error.code === "23505"
      ? "Já existe uma reserva para esta pessoa nesta gira/data."
      : error.code === "P0001" || error.code === "22023"
        ? error.message
        : "Não foi possível concluir a reserva. Tente novamente ou entre em contato com a administração.";
    return response(error.code === "23505" ? 409 : 400, { success: false, message }, origin);
  }

  // Intentionally return only the generic message. Never expose the ticket or reservation ID.
  return response(201, { success: true, message: "Reserva realizada com sucesso." }, origin);
});
