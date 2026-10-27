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
const turnstileStatus = document.getElementById("turnstile-status");

// Token do Turnstile mantido somente em memória e enviado apenas ao endpoint de validação.
let turnstileTokenForHomologation = null;
window.onTurnstileVerified = function (token) {
  turnstileTokenForHomologation = typeof token === "string" ? token : null;
  if (turnstileStatus) {
    turnstileStatus.textContent = turnstileTokenForHomologation
      ? "Verificação concluída. Você já pode enviar a solicitação."
      : "Não foi possível concluir a verificação. O envio permanece bloqueado.";
  }
};
window.onTurnstileExpired = function () {
  turnstileTokenForHomologation = null;
  if (turnstileStatus) turnstileStatus.textContent = "Verificação expirada. Atualize o desafio; nenhuma reserva foi enviada.";
};
window.onTurnstileError = function () {
  turnstileTokenForHomologation = null;
  if (turnstileStatus) turnstileStatus.textContent = "Verificação indisponível. Nenhuma reserva foi enviada.";
};

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
    const eventSelect = document.getElementById("event");
    if (eventSelect) {
      eventSelect.replaceChildren(new Option("Selecione uma gira", ""));
      for (const gira of (Array.isArray(giras) ? giras : [])) {
        const option = new Option(gira.titulo + " — " + formatDate(gira.data_gira), gira.id);
        option.disabled = !Number.isInteger(gira.limite_vagas) || gira.limite_vagas < 1;
        eventSelect.add(option);
      }
      if (eventSelect.options.length === 1) eventSelect.options[0].textContent = "Nenhuma gira disponível";
    }

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
        '<p class="small muted">Selecione esta gira no formulário para solicitar uma reserva.</p></article>';
    }).join("");
  } catch {
    girasList.className = "empty-state";
    girasList.innerHTML = '<div class="calendar-icon" aria-hidden="true">!</div><h3>Agenda temporariamente indisponível</h3><p>Tente novamente mais tarde. Nenhum dado pessoal foi enviado.</p>';
  }
}

if (configMessage) {
  configMessage.textContent =
    "Agenda conectada. As reservas dependem de validação de segurança e disponibilidade.";
}
const reservationSubmit = document.getElementById("reservation-submit");
const preferentialSelect = document.getElementById("preferential");
const preferentialDetails = document.getElementById("preferential-details");
const preferentialType = document.getElementById("preferential-type");
const preferentialDescription = document.getElementById("preferential-description");
const returningSelect = document.getElementById("returning");
const mediumNameWrap = document.getElementById("medium-name-wrap");
const mediumNameInput = document.getElementById("medium-name");

preferentialSelect?.addEventListener("change", () => {
  const needed = preferentialSelect.value === "true";
  if (preferentialDetails) preferentialDetails.hidden = !needed;
  if (preferentialType) preferentialType.required = needed;
  if (!needed) {
    if (preferentialType) preferentialType.value = "";
    if (preferentialDescription) preferentialDescription.value = "";
  }
});
preferentialType?.addEventListener("change", () => {
  if (preferentialDescription) preferentialDescription.required =
    preferentialSelect?.value === "true" && preferentialType.value === "Outro";
});
returningSelect?.addEventListener("change", () => {
  const returning = returningSelect.value === "Sim";
  if (mediumNameWrap) mediumNameWrap.hidden = !returning;
  if (mediumNameInput) {
    mediumNameInput.required = returning;
    if (!returning) mediumNameInput.value = "";
  }
});

reservationForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!reservationForm.reportValidity()) return;
  if (!turnstileTokenForHomologation) {
    if (turnstileStatus) turnstileStatus.textContent = "Conclua a verificação antirobô antes de enviar.";
    return;
  }
  const value = (id) => document.getElementById(id)?.value?.trim() ?? "";
  const payload = {
    gira_id: value("event"),
    nome_completo: value("full-name"),
    data_nascimento: value("dob"),
    telefone: value("phone"),
    email: value("email"),
    primeira_vez: value("first-time"),
    preferencial: value("preferential") === "true",
    turnstile_token: turnstileTokenForHomologation,
  };
  if (payload.preferencial) {
    payload.tipo_preferencial = value("preferential-type");
    if (payload.tipo_preferencial === "Outro") payload.descricao_preferencial = value("preferential-description");
  }
  if (value("returning")) payload.retorno = value("returning");
  if (value("returning") === "Sim") payload.medium_nome = value("medium-name");
  reservationSubmit.disabled = true;
  reservationSubmit.textContent = "Enviando…";
  const configMessage = document.getElementById("config-message");
  if (configMessage) configMessage.textContent = "Validando dados e disponibilidade…";
  try {
    const response = await fetch(SUPABASE_URL + "/functions/v1/criar-reserva", {
      method: "POST",
      headers: { apikey: SUPABASE_PUBLIC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) throw new Error(result?.message || "Não foi possível concluir a reserva. Tente novamente.");
    reservationForm.reset();
    turnstileTokenForHomologation = null;
    if (window.turnstile?.reset) window.turnstile.reset();
    if (preferentialDetails) preferentialDetails.hidden = true;
    if (mediumNameWrap) mediumNameWrap.hidden = true;
    if (preferentialType) preferentialType.required = false;
    if (preferentialDescription) preferentialDescription.required = false;
    if (configMessage) configMessage.textContent = result.message || "Solicitação recebida.";
    if (turnstileStatus) turnstileStatus.textContent = "Verificação utilizada. Faça uma nova verificação para outra solicitação.";
  } catch (error) {
    turnstileTokenForHomologation = null;
    if (window.turnstile?.reset) window.turnstile.reset();
    if (configMessage) configMessage.textContent = error instanceof Error ? error.message : "Serviço indisponível. Tente novamente.";
    if (turnstileStatus) turnstileStatus.textContent = "Por segurança, a verificação foi reiniciada.";
  } finally {
    reservationSubmit.disabled = false;
    reservationSubmit.textContent = "Solicitar reserva";
  }
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
  heading.textContent = "Área administrativa — " + TEAM_ROLE_LABELS[role];
  const detail = document.createElement("p");
  detail.className = "muted";
  detail.textContent = role === "operador"
    ? "Consulta protegida. Dados de contato, nascimento e identificação do médium são ocultados para este papel. Ações sensíveis estão bloqueadas durante a homologação."
    : "Consulta protegida de reservas. Cancelar, reabrir e excluir permanecem bloqueados até a homologação de permissões e APIs.";
  const filters = document.createElement("form");
  filters.className = "admin-filters";
  filters.innerHTML = `
    <label for="admin-search">Nome ou senha</label><input id="admin-search" name="query" maxlength="100" placeholder="Buscar por nome ou senha">
    <label for="admin-status">Status</label><select id="admin-status" name="status"><option value="">Todos</option><option value="ativa">Ativa</option><option value="cancelada">Cancelada</option><option value="pendente_validacao">Pendente de validação</option><option value="excluida">Excluída</option></select>
    <label for="admin-gira">Gira</label><select id="admin-gira" name="gira_id"><option value="">Todas as giras</option></select>
    <label for="admin-type">Tipo de gira</label><input id="admin-type" name="tipo_gira" maxlength="80" placeholder="Filtrar tipo (opcional)">
    <div class="admin-date-row"><div><label for="admin-from">Data da gira — de</label><input id="admin-from" name="data_inicio" type="date"></div><div><label for="admin-to">até</label><input id="admin-to" name="data_fim" type="date"></div></div>
    <div class="admin-filter-actions"><button type="submit">Pesquisar</button><button type="reset" class="secondary-button">Limpar filtros</button></div>`;
  const status = document.createElement("p");
  status.className = "small muted";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const results = document.createElement("div");
  results.className = "admin-results";
  const pagination = document.createElement("div");
  pagination.className = "admin-pagination";
  let page = 1;
  let currentGiras = [];
  const getToken = () => {
    try {
      const session = JSON.parse(sessionStorage.getItem(TEAM_SESSION_KEY) || "null");
      if (!session?.access_token || !session.expires_at || Date.now() >= session.expires_at - 30000) return null;
      return session.access_token;
    } catch { return null; }
  };
  const fetchReservations = async () => {
    const token = getToken();
    if (!token) { clearTeamSession(); setTeamStatus("Sessão expirada. Entre novamente."); return; }
    status.textContent = "Consultando reservas protegidas…";
    results.replaceChildren();
    pagination.replaceChildren();
    const formData = new FormData(filters);
    const payload = { page, page_size: 25 };
    for (const key of ["query", "status", "gira_id", "tipo_gira", "data_inicio", "data_fim"]) {
      const value = String(formData.get(key) || "").trim();
      if (value) payload[key] = value;
    }
    try {
      const response = await fetch(SUPABASE_URL + "/functions/v1/listar-reservas", {
        method: "POST",
        headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(payload), cache: "no-store"
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        if (response.status === 401) { clearTeamSession(); setTeamStatus("Sessão expirada ou inválida. Entre novamente."); return; }
        throw new Error("Consulta não autorizada ou indisponível.");
      }
      currentGiras = Array.isArray(result.giras) ? result.giras : [];
      const giraSelect = filters.elements.namedItem("gira_id");
      const selected = String(formData.get("gira_id") || "");
      if (giraSelect.options.length <= 1) {
        giraSelect.replaceChildren(new Option("Todas as giras", ""));
        for (const gira of currentGiras) giraSelect.add(new Option(gira.titulo + " — " + formatDate(gira.data_gira), gira.id));
      }
      giraSelect.value = selected;
      status.textContent = result.total + " reserva(s) encontrada(s) · página " + result.page + " · papel: " + TEAM_ROLE_LABELS[result.role];
      if (!result.data.length) {
        results.innerHTML = '<div class="empty-state"><h3>Nenhuma reserva encontrada</h3><p>Altere os filtros e tente novamente.</p></div>';
      } else {
        const table = document.createElement("table");
        table.className = "admin-table";
        const headers = role === "operador"
          ? ["Senha", "Nome", "Gira", "Status", "Preferencial", "Ações"]
          : ["Senha", "Nome", "Gira", "Contato", "Nascimento", "Status", "Preferencial", "Ações"];
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        headers.forEach(label => { const th = document.createElement("th"); th.textContent = label; headerRow.append(th); });
        thead.append(headerRow);
        const tbody = document.createElement("tbody");
        for (const item of result.data) {
          const tr = document.createElement("tr");
          const values = role === "operador"
            ? [item.senha_original || String(item.senha_numero ?? "—"), item.nome_completo, item.gira?.titulo || "—", item.status, item.preferencial ? (item.tipo_preferencial || "Sim") : "Não"]
            : [item.senha_original || String(item.senha_numero ?? "—"), item.nome_completo, item.gira?.titulo || "—", [item.telefone, item.email].filter(Boolean).join(" · ") || "—", item.data_nascimento ? formatDate(item.data_nascimento) : "—", item.status, item.preferencial ? (item.tipo_preferencial || "Sim") : "Não"];
          values.forEach(value => { const td = document.createElement("td"); td.textContent = String(value ?? "—"); tr.append(td); });
          const actions = document.createElement("td");
          const locked = document.createElement("button");
          locked.type = "button"; locked.disabled = true;
          locked.textContent = "Ações bloqueadas";
          locked.title = role === "admin" ? "Liberar somente após testes de segurança e homologação." : "Este papel não pode executar ações sensíveis.";
          actions.append(locked); tr.append(actions); tbody.append(tr);
        }
        table.append(thead, tbody);
        const scroll = document.createElement("div"); scroll.className = "admin-table-scroll"; scroll.append(table); results.append(scroll);
      }
      const pageCount = Math.max(1, Math.ceil(result.total / result.page_size));
      if (page > 1) { const prev = document.createElement("button"); prev.type = "button"; prev.className = "secondary-button"; prev.textContent = "Anterior"; prev.addEventListener("click", () => { page--; fetchReservations(); }); pagination.append(prev); }
      if (page < pageCount) { const next = document.createElement("button"); next.type = "button"; next.textContent = "Próxima"; next.addEventListener("click", () => { page++; fetchReservations(); }); pagination.append(next); }
    } catch {
      status.textContent = "Não foi possível carregar a listagem protegida. Nenhuma ação foi executada.";
    }
  };
  filters.addEventListener("submit", event => { event.preventDefault(); page = 1; fetchReservations(); });
  filters.addEventListener("reset", () => { page = 1; setTimeout(fetchReservations, 0); });
  const logout = document.createElement("button");
  logout.type = "button"; logout.className = "secondary-button"; logout.textContent = "Encerrar sessão";
  logout.addEventListener("click", async () => {
    const token = getToken();
    clearTeamSession(); setTeamStatus("Sessão encerrada neste navegador.");
    if (token) { try { await fetch(SUPABASE_URL + "/auth/v1/logout", { method: "POST", headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: "Bearer " + token } }); } catch { /* sessão local já encerrada */ } }
  });
  teamSession.append(heading, detail, filters, status, results, pagination, logout);
  teamSession.hidden = false;
  if (teamLoginForm) teamLoginForm.hidden = true;
  fetchReservations();
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
