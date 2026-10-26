export type ReservationPayload = Record<string, unknown>;

const ALLOWED_FIELDS = new Set([
  "gira_id", "nome_completo", "data_nascimento", "telefone", "email",
  "primeira_vez", "preferencial", "tipo_preferencial", "descricao_preferencial", "retorno", "medium_nome",
  "turnstile_token",
]);
const PREFERENTIAL_TYPES = ["Gestante", "Idoso", "Criança de Colo", "PCD", "Outro"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateReservationInput(body: ReservationPayload): string | null {
  if (Object.keys(body).some((key) => !ALLOWED_FIELDS.has(key))) {
    return "Campos não reconhecidos.";
  }

  const required = ["gira_id", "nome_completo", "data_nascimento", "telefone", "email", "primeira_vez", "turnstile_token"];
  if (required.some((key) => typeof body[key] !== "string" || !(body[key] as string).trim())) {
    return "Preencha os campos obrigatórios.";
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
      dob > new Date().toISOString().slice(0, 10) ||
      (typeof body.descricao_preferencial === "string" && body.descricao_preferencial.length > 300) ||
      !UUID_PATTERN.test(body.gira_id as string) ||
      !["Sim", "Não"].includes(body.primeira_vez as string) ||
      typeof retorno !== "string" ||
      (retorno !== "" && !["Sim", "Não"].includes(retorno)) ||
      typeof mediumNome !== "string" || mediumNome.length > 180 ||
      (retorno !== "Sim" && mediumNome.trim() !== "") ||
      (body.tipo_preferencial != null && typeof body.tipo_preferencial !== "string") ||
      (body.descricao_preferencial != null && typeof body.descricao_preferencial !== "string")) {
    return "Confira os dados informados.";
  }

  if (body.preferencial === true &&
      !PREFERENTIAL_TYPES.includes(String(body.tipo_preferencial ?? ""))) {
    return "Selecione um tipo de atendimento preferencial válido.";
  }
  if (body.preferencial !== true && body.preferencial !== false) {
    return "Informe se necessita de atendimento preferencial.";
  }
  if (body.preferencial === true && body.tipo_preferencial === "Outro" &&
      (typeof body.descricao_preferencial !== "string" ||
       !body.descricao_preferencial.trim() || body.descricao_preferencial.trim().length > 300)) {
    return "Descreva a necessidade de atendimento preferencial (até 300 caracteres).";
  }

  return null;
}
