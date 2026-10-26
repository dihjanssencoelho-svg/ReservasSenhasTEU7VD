/*
 * TEU7VD — leitura pública da agenda publicada.
 * A chave publishable é própria para frontend; nunca incluir chave secret/service_role aqui.
 * O formulário permanece desativado até deploy/configuração e homologação do backend de reservas.
 */
const SUPABASE_URL = "https://emwnytvlbpgiwqswojze.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_gKuJbxS6UBnsodjgdasDIQ_G2k_FL31";

const configMessage = document.getElementById("config-message");
const girasList = document.getElementById("giras-list");
const reservationForm = document.getElementById("reservation-form");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function formatDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  if (!match) return "Data a confirmar";
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

async function loadPublishedGiras() {
  if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY || !girasList) return;
  girasList.className = "empty-state";
  girasList.innerHTML = "<p>Consultando a agenda publicada…</p>";

  try {
    const url = new URL("/rest/v1/giras", SUPABASE_URL);
    url.searchParams.set("select", "id,titulo,data_gira,limite_vagas,tipo_gira");
    url.searchParams.set("ativa", "eq.true");
    url.searchParams.set("status", "eq.publicada");
    url.searchParams.set("order", "data_gira.asc");

    const result = await fetch(url, {
      headers: {
        apikey: SUPABASE_PUBLIC_KEY,
        Accept: "application/json"
      },
      cache: "no-store"
    });
    if (!result.ok) throw new Error("agenda_unavailable");
    const giras = await result.json();

    if (!Array.isArray(giras) || giras.length === 0) {
      girasList.className = "empty-state";
      girasList.innerHTML = '<div class="calendar-icon" aria-hidden="true">▦</div><h3>Nenhuma gira publicada no momento</h3><p>As datas aparecerão aqui após validação e publicação pela administração.</p>';
      return;
    }

    girasList.className = "giras-grid";
    girasList.innerHTML = giras.map((gira) => {
      const vagas = Number.isInteger(gira.limite_vagas) ? gira.limite_vagas : null;
      return '<article class="gira-card"><p class="eyebrow">' + escapeHtml(formatDate(gira.data_gira)) +
        '</p><h3>' + escapeHtml(gira.titulo) + '</h3>' +
        (gira.tipo_gira ? '<p class="muted">' + escapeHtml(gira.tipo_gira) + '</p>' : '') +
        '<p class="gira-vacancies">' + (vagas === null ? 'Vagas a confirmar' : escapeHtml(vagas) + ' vagas previstas') + '</p>' +
        '<p class="small muted">Solicitação de reserva ainda não liberada.</p></article>';
    }).join("");
  } catch {
    girasList.className = "empty-state";
    girasList.innerHTML = '<div class="calendar-icon" aria-hidden="true">!</div><h3>Agenda temporariamente indisponível</h3><p>Tente novamente mais tarde. Nenhum dado pessoal foi enviado.</p>';
  }
}

if (configMessage) {
  configMessage.textContent =
    "Agenda conectada para leitura pública. O formulário continua desativado até a homologação do backend seguro.";
}
reservationForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  // Intencionalmente não coleta nem grava dados enquanto a reserva não for homologada.
});

loadPublishedGiras();


// Login de equipe pelo próprio portal. Nenhuma ação administrativa é executada nesta fase.
const teamAccessToggle = document.getElementById("team-access-toggle");
const teamAccess = document.getElementById("team-access");
const teamLoginForm = document.getElementById("team-login-form");
const teamLoginStatus = document.getElementById("team-login-status");
const teamSession = document.getElementById("team-session");
const teamLoginSubmit = document.getElementById("team-login-submit");
const TEAM_SESSION_KEY = "teu7vd_team_session_v1";
const TEAM_ROLE_LABELS = { admin: "Administrador", gestor: "Gestor", operador: "Operador" };

function setTeamStatus(message) {
  if (teamLoginStatus) teamLoginStatus.textContent = message;
}
function clearTeamSession() {
  try { sessionStorage.removeItem(TEAM_SESSION_KEY); } catch { /* storage indisponível */ }
  if (teamSession) { teamSession.hidden = true; teamSession.replaceChildren(); }
  if (teamLoginForm) teamLoginForm.hidden = false;
  if (teamLoginSubmit) teamLoginSubmit.disabled = false;
}
function showTeamSession(role) {
  if (!teamSession) return;
  teamSession.replaceChildren();
  const heading = document.createElement("h3");
  heading.textContent = "Identidade confirmada: " + TEAM_ROLE_LABELS[role];
  const detail = document.createElement("p");
  detail.textContent = "A autenticação foi validada, mas o painel operacional ainda não está liberado. Nenhuma ação administrativa pode ser executada nesta fase.";
  const logout = document.createElement("button");
  logout.type = "button";
  logout.textContent = "Encerrar sessão";
  logout.addEventListener("click", async () => {
    let token = null;
    try { token = JSON.parse(sessionStorage.getItem(TEAM_SESSION_KEY) || "null")?.access_token; } catch { /* sessão inválida */ }
    clearTeamSession();
    setTeamStatus("Sessão encerrada neste navegador.");
    if (token) {
      try { await fetch(SUPABASE_URL + "/auth/v1/logout", { method: "POST", headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: "Bearer " + token } }); } catch { /* a sessão local já foi encerrada */ }
    }
  });
  teamSession.append(heading, detail, logout);
  teamSession.hidden = false;
  if (teamLoginForm) teamLoginForm.hidden = true;
}

teamAccessToggle?.addEventListener("click", () => {
  const willOpen = teamAccess?.hidden ?? true;
  if (teamAccess) teamAccess.hidden = !willOpen;
  teamAccessToggle.setAttribute("aria-expanded", String(willOpen));
  if (willOpen) document.getElementById("team-email")?.focus();
});

teamLoginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearTeamSession();
  setTeamStatus("Validando credenciais e permissões…");
  if (teamLoginSubmit) teamLoginSubmit.disabled = true;
  const email = String(document.getElementById("team-email")?.value || "").trim();
  const password = String(document.getElementById("team-password")?.value || "");
  try {
    const authResponse = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: SUPABASE_PUBLIC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store"
    });
    if (!authResponse.ok) throw new Error("not_authorized");
    const auth = await authResponse.json();
    if (!auth.access_token || !auth.user?.id) throw new Error("not_authorized");

    const profileUrl = new URL("/rest/v1/perfis_admin", SUPABASE_URL);
    profileUrl.searchParams.set("select", "user_id,papel,ativo");
    profileUrl.searchParams.set("user_id", "eq." + auth.user.id);
    profileUrl.searchParams.set("limit", "1");
    const profileResponse = await fetch(profileUrl, {
      headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: "Bearer " + auth.access_token, Accept: "application/json" },
      cache: "no-store"
    });
    if (!profileResponse.ok) throw new Error("not_authorized");
    const profiles = await profileResponse.json();
    const profile = Array.isArray(profiles) ? profiles[0] : null;
    if (!profile || profile.user_id !== auth.user.id || profile.ativo !== true || !Object.hasOwn(TEAM_ROLE_LABELS, profile.papel)) {
      try { await fetch(SUPABASE_URL + "/auth/v1/logout", { method: "POST", headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: "Bearer " + auth.access_token } }); } catch { /* no-op */ }
      throw new Error("not_authorized");
    }
    // Somente token de sessão em sessionStorage (aba atual); sem credenciais ou service_role.
    sessionStorage.setItem(TEAM_SESSION_KEY, JSON.stringify({ access_token: auth.access_token, refresh_token: auth.refresh_token, expires_at: Date.now() + Number(auth.expires_in || 0) * 1000, role: profile.papel }));
    const passwordField = document.getElementById("team-password");
    if (passwordField) passwordField.value = "";
    setTeamStatus("Acesso autorizado.");
    showTeamSession(profile.papel);
  } catch {
    clearTeamSession();
    setTeamStatus("Não foi possível autorizar o acesso. Confira os dados ou solicite ao administrador que verifique se sua conta possui perfil ativo. Nenhuma informação administrativa foi exibida.");
  } finally {
    if (teamLoginSubmit) teamLoginSubmit.disabled = false;
  }
});
