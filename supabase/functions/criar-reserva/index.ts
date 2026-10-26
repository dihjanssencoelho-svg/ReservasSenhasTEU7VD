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

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return response(400, { success: false, message: "Solicitação inválida." }, origin);
  }
  if (new TextEncoder().encode(rawBody).byteLength > 12000) {
    return response(413, { success: false, message: "Solicitação muito grande." }, origin);
  }
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid body");
    body = parsed as Record<string, unknown>;
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
  const parsedDob = /^\d{4}-\d{2}-\d{2}$/.test(dob) ? new Date(dob + "T00:00:00.000Z") : null;
  const validDob = parsedDob !== null && !Number.isNaN(parsedDob.getTime()) && parsedDob.toISOString().slice(0, 10) === dob;
  const retorno = body.retorno == null ? "" : body.retorno;
  const mediumNome = body.medium_nome == null ? "" : body.medium_nome;
  const phoneDigits = phone.replace(/\D/g, "");
  if (name.length > 180 || email.length > 254 || phone.length > 32 ||
      phoneDigits.length < 10 || phoneDigits.length > 15 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !validDob ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.gira_id as string) ||
      !["Sim", "Não"].includes(body.primeira_vez as string) ||
      (typeof retorno !== "string") ||
      (retorno !== "" && !["Sim", "Não"].includes(retorno)) ||
      (typeof mediumNome !== "string") || mediumNome.length > 180 ||
      (retorno !== "Sim" && mediumNome.trim() !== "") ||
      (body.tipo_preferencial != null && typeof body.tipo_preferencial !== "string") ||
      (body.descricao_preferencial != null && typeof body.descricao_preferencial !== "string")) {
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
  let captchaOk = false;
  try {
    captchaOk = await verifyTurnstile(body.turnstile_token as string, remoteIp);
  } catch {
    // Fail closed: indisponibilidade do provedor nunca libera uma reserva sem validação.
    captchaOk = false;
  }
  if (!captchaOk) return response(403, { success: false, message: "Não foi possível validar a proteção contra envios automáticos. Tente novamente." }, origin);

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
    p_retorno: retorno === "" ? null : retorno,
    p_medium_nome: retorno === "Sim" && mediumNome.trim() !== "" ? mediumNome.trim() : null,
    p_descricao_preferencial: typeof body.descricao_preferencial === "string" ? body.descricao_preferencial : null,
  });

  if (error) {
    // Não encaminhar mensagens SQL ao público; códigos conhecidos recebem mensagens controladas.
    const knownMessages: Record<string, string> = {
      "23505": "Já existe uma reserva para esta pessoa nesta gira/data.",
      "P0001": "Esta gira não está disponível ou não há vagas. Confira a agenda e tente novamente.",
      "22023": "Confira os campos obrigatórios e os dados de atendimento preferencial.",
    };
    const message = knownMessages[error.code ?? ""] ??
      "Não foi possível concluir a reserva. Tente novamente ou entre em contato com a administração.";
    const status = error.code === "23505" ? 409 :
      error.code === "P0001" || error.code === "22023" ? 400 : 503;
    return response(status, { success: false, message }, origin);
  }

  // Intentionally return only the generic message. Never expose the ticket or reservation ID.
  return response(201, { success: true, message: "Reserva realizada com sucesso." }, origin);
});
