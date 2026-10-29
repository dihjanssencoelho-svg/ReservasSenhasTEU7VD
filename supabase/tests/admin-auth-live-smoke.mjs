import assert from "node:assert/strict";

const url = (process.env.SUPABASE_URL || "https://emwnytvlbpgiwqswojze.supabase.co").replace(/\/$/, "");
const key = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_gKuJbxS6UBnsodjgdasDIQ_G2k_FL31";
const origin = process.env.TEU7VD_ALLOWED_ORIGIN || "https://dihjanssencoelho-svg.github.io";
const email = process.env.TEU7VD_TEST_ADMIN_EMAIL;
const password = process.env.TEU7VD_TEST_ADMIN_PASSWORD;

if (!email || !password) {
  console.log("SKIP: para executar o teste HTTP positivo de administrador, configure os secrets TEU7VD_TEST_ADMIN_EMAIL e TEU7VD_TEST_ADMIN_PASSWORD no GitHub Actions.");
  process.exit(0);
}

const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: key, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
if (!login.ok) {
  throw new Error(`Login do administrador de teste falhou (HTTP ${login.status}); credenciais não foram exibidas.`);
}
const session = await login.json();
assert.equal(typeof session.access_token, "string", "O Supabase Auth não retornou uma sessão.");
assert.ok(session.access_token.length > 0, "O token de sessão veio vazio.");

const response = await fetch(`${url}/functions/v1/admin-reservas`, {
  method: "POST",
  headers: {
    apikey: key,
    Authorization: `Bearer ${session.access_token}`,
    Origin: origin,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    action: "cancel",
    reservation_id: "00000000-0000-4000-8000-000000000002",
    reason: "Smoke de autorização; reserva artificial inexistente",
  }),
});
const body = await response.json().catch(() => ({}));

// The fake reservation UUID is absent by design. A valid admin must pass
// authentication/role checks and then reach the RPC, which must reject it
// without mutating a real reservation.
assert.equal(
  response.status,
  400,
  `Esperado HTTP 400 da RPC para reserva artificial inexistente; recebido HTTP ${response.status}.`,
);
assert.equal(body.success, false, "A operação com reserva artificial inexistente não deveria ter sucesso.");
assert.ok(
  !/autenticação necessária|sessão inválida|sem permissão|não tem permissão/i.test(String(body.message || "")),
  "A sessão não chegou à validação de negócio; confira o perfil admin de teste.",
);
console.log("PASSOU: JWT de administrador validado pelo endpoint real; a reserva artificial inexistente foi rejeitada sem mutação.");
