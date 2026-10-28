/*
 * TEU7VD — portal público e painel administrativo de reservas.
 * A chave publishable é própria para frontend; nunca incluir chave secret/service_role aqui.
 * O envio público exige validação Turnstile e autorização do backend.
 */
const SUPABASE_URL = "https://emwnytvlbpgiwqswojze.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_gKuJbxS6UBnsodjgdasDIQ_G2k_FL31";

const configMessage = document.getElementById("config-message");
const girasList = document.getElementById("giras-list");
const reservationForm = document.getElementById("reservation-form");
const reservationPanel = document.getElementById("reservation-panel");
const turnstileStatus = document.getElementById("turnstile-status");
let publicPortalSettings = { mensagem_confirmacao: "Solicitação recebida com sucesso.", limite_alerta_vagas: 5 };

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

function birthdayWithinGiraWeek(birthDate, giraDate) {
  const birth = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthDate ?? ""));
  const gira = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(giraDate ?? ""));
  if (!birth || !gira) return false;
  const year = Number(gira[1]);
  const month = Number(birth[2]) - 1;
  const day = Number(birth[3]);
  const candidates = [year - 1, year, year + 1].map(y => {
    const d = new Date(Date.UTC(y, month, day));
    if (d.getUTCMonth() !== month) d.setUTCDate(0);
    return d.getTime();
  });
  const target = new Date(Date.UTC(Number(gira[1]), Number(gira[2]) - 1, Number(gira[3])));
  const isoDay = target.getUTCDay() || 7;
  const weekStart = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate() - isoDay + 1);
  const weekEnd = weekStart + 6 * 86400000;
  return candidates.some(timestamp => timestamp >= weekStart && timestamp <= weekEnd);
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
    let vacancyByGira = new Map();
    try {
      const settingsResponse = await fetch(SUPABASE_URL + "/rest/v1/rpc/teu7vd_configuracoes_publicas", {
        method: "POST", headers: { apikey: SUPABASE_PUBLIC_KEY, "Content-Type": "application/json", Accept: "application/json" },
        body: "{}", cache: "no-store"
      });
      if (settingsResponse.ok) {
        const settingsRows = await settingsResponse.json();
        if (Array.isArray(settingsRows) && settingsRows[0]) {
          publicPortalSettings = settingsRows[0];
          document.documentElement.style.setProperty("--bg", publicPortalSettings.cor_primaria || "#17131e");
          document.documentElement.style.setProperty("--gold", publicPortalSettings.cor_destaque || "#c9a86a");
          if (configMessage && publicPortalSettings.mensagem_publica) configMessage.textContent = publicPortalSettings.mensagem_publica;
        }
      }
    } catch { /* usa configurações padrão em indisponibilidade */ }
    try {
      const metrics = await fetch(SUPABASE_URL + "/rest/v1/rpc/teu7vd_resumo_vagas_publico", {
        method: "POST",
        headers: { apikey: SUPABASE_PUBLIC_KEY, "Content-Type": "application/json", Accept: "application/json" },
        body: "{}",
        cache: "no-store"
      });
      if (metrics.ok) {
        const rows = await metrics.json();
        if (Array.isArray(rows)) vacancyByGira = new Map(rows.map(row => [row.gira_id, row]));
      }
    } catch { /* agenda continua disponível sem métricas */ }
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
      const metric = vacancyByGira.get(gira.id);
      const vacancyText = metric
        ? (Number(metric.vagas_restantes) <= 0 ? "Vagas esgotadas" :
          metric.poucas_vagas ? "Poucas vagas: " + metric.vagas_restantes + " restante(s)" :
          metric.vagas_restantes + " vaga(s) restante(s)") + " · " + metric.ocupacao_percentual + "% ocupadas"
        : (vagas === null ? "Vagas a confirmar" : escapeHtml(vagas) + " vagas previstas");
      const vacancyClass = metric && metric.poucas_vagas ? "gira-vacancies low-vacancy" : "gira-vacancies";
      return '<article class="gira-card" data-gira-id="' + escapeHtml(gira.id) + '" tabindex="0" role="button" aria-controls="reservation-panel" aria-expanded="false" aria-label="Selecionar ' + escapeHtml(gira.titulo) + ' e abrir o formulário"><p class="eyebrow">' + escapeHtml(formatDate(gira.data_gira)) +
        '</p><h3>' + escapeHtml(gira.titulo) + '</h3>' +
        (gira.tipo_gira ? '<p class="muted">' + escapeHtml(gira.tipo_gira) + '</p>' : '') +
        '<p class="' + vacancyClass + '">' + escapeHtml(vacancyText) + '</p>' +
        '<p class="small muted">Selecione esta gira no formulário para solicitar uma reserva.</p></article>';
    }).join("");
    const selectGira = (card) => {
      const eventSelect = document.getElementById("event");
      if (!eventSelect) return;
      const giraId = card?.dataset?.giraId;
      if (!giraId || !Array.from(eventSelect.options).some(option => option.value === giraId && !option.disabled)) return;
      eventSelect.value = giraId;
      if (reservationPanel) reservationPanel.hidden = false;
      girasList.querySelectorAll(".gira-card").forEach(item => {
        const selected = item === card;
        item.classList.toggle("selected", selected);
        item.setAttribute("aria-pressed", String(selected));
        item.setAttribute("aria-expanded", String(selected));
      });
      document.getElementById("reservation-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
      eventSelect.dispatchEvent(new Event("change", { bubbles: true }));
      document.getElementById("full-name")?.focus({ preventScroll: true });
    };
    girasList.querySelectorAll(".gira-card").forEach(card => {
      card.addEventListener("click", () => selectGira(card));
      card.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectGira(card);
        }
      });
    });
    eventSelect?.addEventListener("change", () => {
      if (reservationPanel) reservationPanel.hidden = !eventSelect.value;
      girasList.querySelectorAll(".gira-card").forEach(card => {
        const selected = card.dataset.giraId === eventSelect.value;
        card.classList.toggle("selected", selected);
        card.setAttribute("aria-pressed", String(selected));
        card.setAttribute("aria-expanded", String(selected));
      });
    });
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
    if (preferentialType) preferentialType.required = false;
    if (preferentialDescription) preferentialDescription.required = false;
    if (configMessage) configMessage.textContent = publicPortalSettings.mensagem_confirmacao || result.message || "Solicitação recebida.";
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
  const overCapacityForm = document.createElement("form");
  overCapacityForm.className = "admin-filters";
  overCapacityForm.hidden = role !== "admin";
  overCapacityForm.innerHTML = `
    <h4>Cadastro administrativo acima da capacidade</h4>
    <p class="small muted">Disponível apenas para administrador ativo. Exige gira publicada, lotação já atingida, motivo e auditoria.</p>
    <label for="override-gira">Gira publicada</label><select id="override-gira" name="gira_id" required><option value="">Carregando giras…</option></select>
    <label for="override-name">Nome completo</label><input id="override-name" name="nome_completo" maxlength="180" required>
    <label for="override-dob">Data de nascimento</label><input id="override-dob" name="data_nascimento" type="date" required>
    <label for="override-phone">Telefone</label><input id="override-phone" name="telefone" type="tel" maxlength="32" required>
    <label for="override-email">E-mail</label><input id="override-email" name="email" type="email" maxlength="254" required>
    <label for="override-first-time">Primeira vez?</label><select id="override-first-time" name="primeira_vez" required><option value="">Selecione</option><option>Sim</option><option>Não</option></select>
    <label for="override-preferential">Atendimento preferencial?</label><select id="override-preferential" name="preferencial" required><option value="false">Não</option><option value="true">Sim</option></select>
    <div id="override-preferential-wrap" hidden>
      <label for="override-preferential-type">Tipo preferencial</label><select id="override-preferential-type" name="tipo_preferencial"><option value="">Selecione</option><option>Gestante</option><option>Idoso</option><option>Criança de Colo</option><option>PCD</option><option>Outro</option></select>
      <label for="override-preferential-description">Descrição (obrigatória para Outro)</label><input id="override-preferential-description" name="descricao_preferencial" maxlength="300">
    </div>
    <label for="override-returning">Retorna com médium?</label><select id="override-returning" name="retorno"><option value="">Não informado</option><option>Sim</option><option>Não</option></select>
    <label for="override-medium">Nome do médium (se aplicável)</label><input id="override-medium" name="medium_nome" maxlength="180">
    <label for="override-reason">Motivo do excedente (5 a 500 caracteres)</label><textarea id="override-reason" name="motivo_excedente" minlength="5" maxlength="500" required></textarea>
    <button type="submit">Registrar excedente</button>
    <p id="override-status" class="small muted" role="status" aria-live="polite"></p>`;
  const overridePreferential = overCapacityForm.querySelector("#override-preferential");
  const overridePreferentialWrap = overCapacityForm.querySelector("#override-preferential-wrap");
  const overridePreferentialType = overCapacityForm.querySelector("#override-preferential-type");
  const overridePreferentialDescription = overCapacityForm.querySelector("#override-preferential-description");
  overridePreferential?.addEventListener("change", () => {
    const active = overridePreferential.value === "true";
    overridePreferentialWrap.hidden = !active;
    overridePreferentialType.required = active;
    overridePreferentialDescription.required = active && overridePreferentialType.value === "Outro";
  });
  overridePreferentialType?.addEventListener("change", () => {
    overridePreferentialDescription.required = overridePreferential.value === "true" && overridePreferentialType.value === "Outro";
  });
  const ordinaryReservationForm = document.createElement("form");
  ordinaryReservationForm.className = "admin-filters";
  ordinaryReservationForm.hidden = role !== "admin";
  ordinaryReservationForm.innerHTML = `
    <h4>Cadastro administrativo comum</h4>
    <p class="small muted">Somente a gira é obrigatória. Os demais dados podem ser preenchidos agora ou atualizados conforme necessário. O cadastro respeita a capacidade normal; excedentes exigem o fluxo específico com justificativa.</p>
    <label for="ordinary-gira">Gira publicada <span class="required-mark">*</span></label><select id="ordinary-gira" name="gira_id" required><option value="">Carregando giras…</option></select>
    <label for="ordinary-name">Nome completo (opcional)</label><input id="ordinary-name" name="nome_completo" maxlength="180">
    <label for="ordinary-dob">Data de nascimento (opcional)</label><input id="ordinary-dob" name="data_nascimento" type="date">
    <label for="ordinary-phone">Telefone (opcional)</label><input id="ordinary-phone" name="telefone" type="tel" maxlength="32">
    <label for="ordinary-email">E-mail (opcional)</label><input id="ordinary-email" name="email" type="email" maxlength="254">
    <label for="ordinary-first-time">Primeira vez? (opcional)</label><select id="ordinary-first-time" name="primeira_vez"><option value="">Não informado</option><option>Sim</option><option>Não</option></select>
    <label for="ordinary-preferential">Atendimento preferencial? (opcional)</label><select id="ordinary-preferential" name="preferencial"><option value="false">Não informado / Não</option><option value="true">Sim</option></select>
    <div id="ordinary-preferential-wrap" hidden>
      <label for="ordinary-preferential-type">Tipo preferencial</label><select id="ordinary-preferential-type" name="tipo_preferencial"><option value="">Selecione</option><option>Gestante</option><option>Idoso</option><option>Criança de Colo</option><option>PCD</option><option>Outro</option></select>
      <label for="ordinary-preferential-description">Descrição (para Outro)</label><input id="ordinary-preferential-description" name="descricao_preferencial" maxlength="300">
    </div>
    <label for="ordinary-return">Retorna com médium? (opcional)</label><select id="ordinary-return" name="retorno"><option value="">Não informado</option><option>Sim</option><option>Não</option></select>
    <label for="ordinary-medium">Nome do médium (opcional)</label><input id="ordinary-medium" name="medium_nome" maxlength="180">
    <button type="submit">Registrar reserva</button>
    <p id="ordinary-reservation-status" class="small muted" role="status" aria-live="polite"></p>`;
  const ordinaryPreferential = ordinaryReservationForm.querySelector("#ordinary-preferential");
  const ordinaryPreferentialWrap = ordinaryReservationForm.querySelector("#ordinary-preferential-wrap");
  const ordinaryPreferentialType = ordinaryReservationForm.querySelector("#ordinary-preferential-type");
  const ordinaryPreferentialDescription = ordinaryReservationForm.querySelector("#ordinary-preferential-description");
  ordinaryPreferential?.addEventListener("change", () => {
    const active = ordinaryPreferential.value === "true";
    ordinaryPreferentialWrap.hidden = !active;
    ordinaryPreferentialType.required = active;
    ordinaryPreferentialDescription.required = active && ordinaryPreferentialType.value === "Outro";
  });
  ordinaryPreferentialType?.addEventListener("change", () => {
    ordinaryPreferentialDescription.required = ordinaryPreferential.value === "true" && ordinaryPreferentialType.value === "Outro";
  });
  const createGiraForm = document.createElement("form");
  createGiraForm.className = "admin-filters";
  createGiraForm.hidden = role !== "admin";
  createGiraForm.innerHTML = `
    <h4>Cadastrar nova gira</h4>
    <p class="small muted">Informe a quantidade total de senhas. A gira será publicada e ficará disponível para reservas após o cadastro.</p>
    <label for="new-gira-title">Nome da gira</label><input id="new-gira-title" name="titulo" maxlength="120" required>
    <label for="new-gira-date">Data</label><input id="new-gira-date" name="data_gira" type="date" required>
    <label for="new-gira-type">Tipo da gira (sequência das senhas)</label><input id="new-gira-type" name="tipo_gira" maxlength="80" required>
    <label for="new-gira-capacity">Quantidade de senhas</label><input id="new-gira-capacity" name="limite_vagas" type="number" min="1" max="10000" step="1" required>
    <button type="submit">Cadastrar gira</button>
    <p id="new-gira-status" class="small muted" role="status" aria-live="polite"></p>`;
  const settingsForm = document.createElement("form");
  settingsForm.className = "admin-filters";
  settingsForm.hidden = role !== "admin";
  settingsForm.innerHTML = `
    <h4>Configurações do portal</h4>
    <label for="portal-public-message">Mensagem pública</label><textarea id="portal-public-message" name="mensagem_publica" maxlength="500" required></textarea>
    <label for="portal-confirmation-message">Mensagem de confirmação</label><textarea id="portal-confirmation-message" name="mensagem_confirmacao" maxlength="500" required></textarea>
    <label for="portal-primary-color">Cor principal</label><input id="portal-primary-color" name="cor_primaria" type="color" value="#17131e" required>
    <label for="portal-accent-color">Cor de destaque</label><input id="portal-accent-color" name="cor_destaque" type="color" value="#c9a86a" required>
    <label for="portal-low-vacancy">Alertar quando restarem até</label><input id="portal-low-vacancy" name="limite_alerta_vagas" type="number" min="0" max="10000" value="5" required>
    <button type="submit">Salvar configurações</button>
    <p id="portal-settings-status" class="small muted" role="status" aria-live="polite"></p>`;
  const restoreForm = document.createElement("form");
  restoreForm.className = "admin-filters";
  restoreForm.hidden = role !== "admin";
  restoreForm.innerHTML = `
    <h4>Importar ou restaurar backup JSON</h4>
    <p class="small muted">Validação primeiro; a prévia não altera dados. A restauração faz merge por identificador, preserva registros ausentes e exige motivo e confirmação explícita.</p>
    <label for="restore-file">Arquivo de backup TEU7VD</label><input id="restore-file" type="file" accept=".json,application/json" required>
    <button type="submit">Validar backup (prévia)</button>
    <p id="restore-preview-status" class="small muted" role="status" aria-live="polite"></p>
    <label for="restore-reason">Motivo da restauração (mínimo 10 caracteres)</label><textarea id="restore-reason" maxlength="500" minlength="10" required></textarea>
    <label for="restore-confirm">Digite RESTAURAR para confirmar</label><input id="restore-confirm" maxlength="20" autocomplete="off" required>
    <button id="restore-apply" type="button" disabled>Aplicar restauração</button>`;
  let restoreJobId = null;
  restoreForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (role !== "admin" || !restoreForm.reportValidity()) return;
    const token = getToken(), file = restoreForm.querySelector("#restore-file").files?.[0];
    const status = restoreForm.querySelector("#restore-preview-status");
    if (!token || !file) { status.textContent = "Sessão administrativa e arquivo são obrigatórios."; return; }
    if (file.size > 12000000) { status.textContent = "O backup excede 12 MB."; return; }
    try {
      const backup = JSON.parse(await file.text());
      status.textContent = "Validando estrutura e registrando prévia sem alterar reservas…";
      const response = await fetch(SUPABASE_URL + "/functions/v1/admin-restaurar-backup", {
        method: "POST", headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview_restore", backup }), cache: "no-store"
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.message || "Backup rejeitado.");
      restoreJobId = result.job_id;
      restoreForm.querySelector("#restore-apply").disabled = false;
      status.textContent = result.message + " Lote: " + restoreJobId + " · " + JSON.stringify(result.resumo);
    } catch (error) { restoreJobId = null; restoreForm.querySelector("#restore-apply").disabled = true; status.textContent = error instanceof Error ? error.message : "Backup rejeitado."; }
  });
  restoreForm.querySelector("#restore-apply").addEventListener("click", async () => {
    const token = getToken(), status = restoreForm.querySelector("#restore-preview-status");
    const reason = restoreForm.querySelector("#restore-reason").value.trim();
    const confirmation = restoreForm.querySelector("#restore-confirm").value.trim();
    if (role !== "admin" || !token || !restoreJobId || reason.length < 10 || reason.length > 500 || confirmation !== "RESTAURAR") {
      status.textContent = "Informe motivo válido e digite exatamente RESTAURAR.";
      return;
    }
    if (!window.confirm("A restauração fará merge dos dados do backup com o banco e poderá atualizar registros existentes. Deseja continuar?")) return;
    const button = restoreForm.querySelector("#restore-apply"); button.disabled = true;
    try {
      const response = await fetch(SUPABASE_URL + "/functions/v1/admin-restaurar-backup", {
        method: "POST", headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply_restore", job_id: restoreJobId, reason }), cache: "no-store"
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.message || "Restauração não aplicada.");
      status.textContent = result.message + " " + JSON.stringify(result.resumo);
      restoreJobId = null;
      restoreForm.reset();
    } catch (error) { status.textContent = error instanceof Error ? error.message : "Restauração não aplicada."; }
    finally { button.disabled = !restoreJobId; }
  });
  const importForm = document.createElement("form");
  importForm.className = "admin-filters";
  importForm.hidden = role !== "admin";
  importForm.innerHTML = `
    <h4>Importar planilha histórica (CSV)</h4>
    <p class="small muted">A importação exige mapear cada linha para uma gira existente por gira_id. Senhas originais são preservadas; reservas ativas não podem exceder a capacidade. A prévia não altera reservas.</p>
    <button id="download-import-template" type="button" class="secondary-button">Baixar modelo CSV</button>
    <label for="import-csv-file">Arquivo CSV (até 5.000 linhas)</label><input id="import-csv-file" type="file" accept=".csv,text/csv" required>
    <button type="submit">Validar importação (prévia)</button>
    <p id="import-preview-status" class="small muted" role="status" aria-live="polite"></p>
    <label for="import-reason">Motivo da importação (mínimo 10 caracteres)</label><textarea id="import-reason" maxlength="500" minlength="10" required></textarea>
    <label for="import-confirm">Digite IMPORTAR para confirmar</label><input id="import-confirm" maxlength="20" autocomplete="off" required>
    <button id="import-apply" type="button" disabled>Aplicar importação</button>`;
  let importJobId = null;
  let importRows = null;
  importForm.querySelector("#download-import-template").addEventListener("click", () => {
    const template = "gira_id;senha_original;nome_completo;data_nascimento;telefone;email;primeira_vez;retorno;medium_nome;preferencial;tipo_preferencial;descricao_preferencial;status;linha_origem\r\n";
    const url = URL.createObjectURL(new Blob(["\\uFEFF",template],{type:"text/csv;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download="modelo-importacao-teu7vd.csv";a.click();URL.revokeObjectURL(url);
  });
  function parseCsv(text) {
    const delimiter = (text.split(/\r?\n/,1)[0].match(/;/g)||[]).length >= (text.split(/\r?\n/,1)[0].match(/,/g)||[]).length ? ";" : ",";
    const rows=[]; let row=[], field="", quoted=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(ch==='"'&&quoted&&text[i+1]==='"'){field+='"';i++;continue;}
      if(ch==='"'){quoted=!quoted;continue;}
      if(ch===delimiter&&!quoted){row.push(field);field="";continue;}
      if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&text[i+1]==="\n")i++;row.push(field);if(row.some(v=>v.trim()!==""))rows.push(row);row=[];field="";continue;}
      field+=ch;
    }
    if(field.length||row.length){row.push(field);if(row.some(v=>v.trim()!==""))rows.push(row);}
    if(!rows.length)throw new Error("O CSV está vazio.");
    const headers=rows.shift().map(v=>v.replace(/^\uFEFF/,"").trim().toLowerCase());
    const required=["gira_id","senha_original","nome_completo","status"];
    if(required.some(k=>!headers.includes(k)))throw new Error("Cabeçalhos obrigatórios: gira_id, senha_original, nome_completo e status.");
    return rows.map((values,i)=>{
      const item={};headers.forEach((h,j)=>item[h]=(values[j]??"").trim());
      item.preferencial=["true","sim","1","yes"].includes(String(item.preferencial||"").toLowerCase());
      item.linha_origem=item.linha_origem||String(i+2);
      return item;
    });
  }
  importForm.addEventListener("submit", async event => {
    event.preventDefault();
    if(role!=="admin"||!importForm.reportValidity())return;
    const token=getToken(),file=importForm.querySelector("#import-csv-file").files?.[0],status=importForm.querySelector("#import-preview-status");
    if(!token||!file){status.textContent="Sessão administrativa e CSV são obrigatórios.";return;}
    if(file.size>6000000){status.textContent="O CSV excede 6 MB.";return;}
    try{
      importRows=parseCsv(await file.text());
      if(importRows.length>5000)throw new Error("O CSV excede 5.000 linhas.");
      status.textContent="Validando "+importRows.length+" linha(s) no servidor…";
      const response=await fetch(SUPABASE_URL+"/functions/v1/admin-import-reservas",{method:"POST",headers:{apikey:SUPABASE_PUBLIC_KEY,Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({action:"preview_import",rows:importRows}),cache:"no-store"});
      const result=await response.json().catch(()=>null);
      if(!response.ok||!result?.success)throw new Error(result?.message||"Importação rejeitada.");
      importJobId=result.job_id;importForm.querySelector("#import-apply").disabled=false;
      status.textContent=result.message+" Lote: "+importJobId+" · "+JSON.stringify(result.resumo);
    }catch(error){importJobId=null;importRows=null;importForm.querySelector("#import-apply").disabled=true;status.textContent=error instanceof Error?error.message:"Importação rejeitada.";}
  });
  importForm.querySelector("#import-apply").addEventListener("click",async()=>{
    const token=getToken(),status=importForm.querySelector("#import-preview-status"),reason=importForm.querySelector("#import-reason").value.trim();
    if(role!=="admin"||!token||!importJobId||reason.length<10||reason.length>500||importForm.querySelector("#import-confirm").value.trim()!=="IMPORTAR"){
      status.textContent="Informe motivo válido e digite exatamente IMPORTAR.";return;
    }
    if(!window.confirm("A importação criará reservas e poderá falhar integralmente por duplicidade, senha conflitante ou capacidade. Continuar?"))return;
    const button=importForm.querySelector("#import-apply");button.disabled=true;
    try{
      const response=await fetch(SUPABASE_URL+"/functions/v1/admin-import-reservas",{method:"POST",headers:{apikey:SUPABASE_PUBLIC_KEY,Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({action:"apply_import",job_id:importJobId,reason}),cache:"no-store"});
      const result=await response.json().catch(()=>null);
      if(!response.ok||!result?.success)throw new Error(result?.message||"Importação não aplicada.");
      status.textContent=result.message+" "+JSON.stringify(result.resumo);importJobId=null;importRows=null;importForm.reset();await fetchReservations();
    }catch(error){status.textContent=error instanceof Error?error.message:"Importação não aplicada.";}
    finally{button.disabled=!importJobId;}
  });
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
  const exportBar = document.createElement("div");
  exportBar.className = "admin-filter-actions";
  const exportCsv = document.createElement("button");
  exportCsv.type = "button";
  exportCsv.className = "secondary-button";
  exportCsv.textContent = "Exportar página para Excel (CSV)";
  const printList = document.createElement("button");
  printList.type = "button";
  printList.className = "secondary-button";
  printList.textContent = "Imprimir lista";
  const backupButton = document.createElement("button");
  backupButton.type = "button";
  backupButton.className = "secondary-button";
  backupButton.textContent = "Gerar backup JSON";
  backupButton.hidden = role !== "admin";
  backupButton.addEventListener("click", async () => {
    const token = getToken();
    if (role !== "admin" || !token) { setTeamStatus("Sessão administrativa necessária."); return; }
    backupButton.disabled = true;
    status.textContent = "Gerando backup integral e registrando auditoria…";
    try {
      const response = await fetch(SUPABASE_URL + "/functions/v1/admin-backup", {
        method: "POST", headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export_backup" }), cache: "no-store"
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success || !result.backup) throw new Error(result?.message || "Backup não concluído.");
      const blob = new Blob([JSON.stringify(result.backup, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "teu7vd-backup-" + new Date().toISOString().slice(0,10) + ".json"; a.click();
      URL.revokeObjectURL(url);
      status.textContent = "Backup completo gerado e auditado. Guarde o arquivo em local restrito: contém dados pessoais.";
    } catch (error) { status.textContent = error instanceof Error ? error.message : "Backup não concluído."; }
    finally { backupButton.disabled = false; }
  });
  exportBar.append(exportCsv, printList);
  let exportRows = [];
  exportCsv.addEventListener("click", () => {
    if (!exportRows.length) { status.textContent = "Não há registros nesta página para exportar."; return; }
    const columns = role === "admin"
      ? [["Senha", x => x.senha_original || x.senha_numero],["Nome", x => x.nome_completo],["Gira", x => x.gira?.titulo],["Data da gira", x => x.gira?.data_gira],["Telefone", x => x.telefone],["E-mail", x => x.email],["Nascimento", x => x.data_nascimento],["Aniversário na semana", x => birthdayWithinGiraWeek(x.data_nascimento, x.gira?.data_gira) ? "Sim" : "Não"],["Status", x => x.status],["Preferencial", x => x.preferencial ? (x.tipo_preferencial || "Sim") : "Não"]]
      : [["Senha", x => x.senha_original || x.senha_numero],["Nome", x => x.nome_completo],["Gira", x => x.gira?.titulo],["Data da gira", x => x.gira?.data_gira],["Status", x => x.status],["Preferencial", x => x.preferencial ? (x.tipo_preferencial || "Sim") : "Não"]];
    const quote = value => '"' + String(value ?? "").replace(/"/g, '""') + '"';
    const csv = "\uFEFF" + [columns.map(c => quote(c[0])).join(";"), ...exportRows.map(row => columns.map(col => quote(col[1](row))).join(";"))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "reservas-pagina-" + page + ".csv"; a.click(); URL.revokeObjectURL(url);
  });
  printList.addEventListener("click", () => {
    const prior = document.title; document.title = "Lista de reservas TEU7VD - página " + page;
    window.print(); document.title = prior;
  });
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
      const ordinaryGira = ordinaryReservationForm.querySelector("#ordinary-gira");
      if (ordinaryGira && ordinaryGira.options.length <= 1) {
        ordinaryGira.replaceChildren(new Option("Selecione uma gira", ""));
        for (const gira of currentGiras.filter(g => g.ativa === true && g.status === "publicada" && Number.isInteger(g.limite_vagas))) {
          ordinaryGira.add(new Option(gira.titulo + " — " + formatDate(gira.data_gira), gira.id));
        }
        if (ordinaryGira.options.length === 1) ordinaryGira.options[0].textContent = "Nenhuma gira publicada elegível";
      }
      const overrideGira = overCapacityForm.querySelector("#override-gira");
      if (overrideGira && overrideGira.options.length <= 1) {
        overrideGira.replaceChildren(new Option("Selecione uma gira", ""));
        for (const gira of currentGiras.filter(g => g.ativa === true && g.status === "publicada" && Number.isInteger(g.limite_vagas))) {
          const option = new Option(gira.titulo + " — " + formatDate(gira.data_gira), gira.id);
          overrideGira.add(option);
        }
        if (overrideGira.options.length === 1) overrideGira.options[0].textContent = "Nenhuma gira publicada elegível";
      }
      const giraSelect = filters.elements.namedItem("gira_id");
      const selected = String(formData.get("gira_id") || "");
      if (giraSelect.options.length <= 1) {
        giraSelect.replaceChildren(new Option("Todas as giras", ""));
        for (const gira of currentGiras) giraSelect.add(new Option(gira.titulo + " — " + formatDate(gira.data_gira), gira.id));
      }
      giraSelect.value = selected;
      exportRows = Array.isArray(result.data) ? result.data : [];
      status.textContent = result.total + " reserva(s) encontrada(s) · página " + result.page + " · papel: " + TEAM_ROLE_LABELS[result.role];
      if (!result.data.length) {
        results.innerHTML = '<div class="empty-state"><h3>Nenhuma reserva encontrada</h3><p>Altere os filtros e tente novamente.</p></div>';
      } else {
        const table = document.createElement("table");
        table.className = "admin-table";
        const headers = role === "operador"
          ? ["Senha", "Nome", "Gira", "Status", "Preferencial", "Ações"]
          : ["Senha", "Nome", "Gira", "Contato", "Nascimento", "Aniversário", "Status", "Preferencial", "Ações"];
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        headers.forEach(label => { const th = document.createElement("th"); th.textContent = label; headerRow.append(th); });
        thead.append(headerRow);
        const tbody = document.createElement("tbody");
        for (const item of result.data) {
          const tr = document.createElement("tr");
          const values = role === "operador"
            ? [item.senha_original || String(item.senha_numero ?? "—"), item.nome_completo, item.gira?.titulo || "—", item.status, item.preferencial ? (item.tipo_preferencial || "Sim") : "Não"]
            : [item.senha_original || String(item.senha_numero ?? "—"), item.nome_completo, item.gira?.titulo || "—", [item.telefone, item.email].filter(Boolean).join(" · ") || "—", item.data_nascimento ? formatDate(item.data_nascimento) : "—", birthdayWithinGiraWeek(item.data_nascimento, item.gira?.data_gira) ? "🎂 Nesta semana da gira" : "—", item.status, item.preferencial ? (item.tipo_preferencial || "Sim") : "Não"];
          values.forEach(value => { const td = document.createElement("td"); td.textContent = String(value ?? "—"); tr.append(td); });
          const actions = document.createElement("td");
          if (role === "admin") {
            const returnForm = document.createElement("form");
            returnForm.className = "admin-return-editor";
            const returnLabel = document.createElement("label");
            returnLabel.textContent = "Retorno com médium";
            const returnSelect = document.createElement("select");
            returnSelect.setAttribute("aria-label", "Retorno com médium");
            [["", "Não informado"], ["Sim", "Sim"], ["Não", "Não"]].forEach(([value, label]) => returnSelect.add(new Option(label, value)));
            returnSelect.value = item.retorno || "";
            const mediumLabel = document.createElement("label");
            mediumLabel.textContent = "Nome do médium";
            const mediumInput = document.createElement("input");
            mediumInput.type = "text"; mediumInput.maxLength = 180;
            mediumInput.value = item.medium_nome || "";
            mediumInput.placeholder = "Nome do médium (opcional)";
            mediumInput.disabled = returnSelect.value !== "Sim";
            returnSelect.addEventListener("change", () => {
              mediumInput.disabled = returnSelect.value !== "Sim";
              if (mediumInput.disabled) mediumInput.value = "";
            });
            const saveReturn = document.createElement("button");
            saveReturn.type = "submit"; saveReturn.textContent = "Salvar retorno";
            const returnStatus = document.createElement("p");
            returnStatus.className = "small muted"; returnStatus.setAttribute("role", "status");
            returnForm.append(returnLabel, returnSelect, mediumLabel, mediumInput, saveReturn, returnStatus);
            returnForm.addEventListener("submit", async event => {
              event.preventDefault();
              const token = getToken();
              if (!token) { returnStatus.textContent = "Sessão expirada. Entre novamente."; return; }
              saveReturn.disabled = true; returnStatus.textContent = "Salvando com auditoria…";
              try {
                const response = await fetch(SUPABASE_URL + "/functions/v1/admin-reservas", {
                  method: "POST",
                  headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "update_return", reservation_id: item.id, retorno: returnSelect.value, medium_nome: mediumInput.value.trim() }),
                  cache: "no-store"
                });
                const result = await response.json().catch(() => null);
                if (!response.ok || !result?.success) throw new Error(result?.message || "Não foi possível salvar.");
                returnStatus.textContent = "Retorno atualizado e auditado.";
                item.retorno = returnSelect.value || null;
                item.medium_nome = returnSelect.value === "Sim" ? mediumInput.value.trim() : null;
              } catch (error) { returnStatus.textContent = error instanceof Error ? error.message : "Não foi possível salvar."; }
              finally { saveReturn.disabled = false; }
            });
            actions.append(returnForm);
          }
          if (role === "admin" && item.status !== "excluida") {
            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "danger-button";
            deleteButton.textContent = "Excluir reserva";
            deleteButton.title = "Exclui com auditoria e libera a senha para reutilização segura.";
            deleteButton.addEventListener("click", async () => {
              const reason = window.prompt("Informe o motivo da exclusão desta reserva (mínimo 5 caracteres):", "Exclusão administrativa solicitada");
              if (reason === null) return;
              if (reason.trim().length < 5 || reason.trim().length > 500) {
                window.alert("O motivo deve ter entre 5 e 500 caracteres.");
                return;
              }
              if (!window.confirm("Confirmar exclusão da reserva " + (item.senha_original || item.senha_numero || "") + "? A senha será liberada para reutilização.")) return;
              const token = getToken();
              if (!token) { clearTeamSession(); setTeamStatus("Sessão expirada. Entre novamente."); return; }
              deleteButton.disabled = true;
              deleteButton.textContent = "Excluindo…";
              try {
                const response = await fetch(SUPABASE_URL + "/functions/v1/admin-reservas", {
                  method: "POST",
                  headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "delete", reservation_id: item.id, reason: reason.trim() }),
                  cache: "no-store"
                });
                const result = await response.json().catch(() => null);
                if (!response.ok || !result?.success) throw new Error(result?.message || "Não foi possível excluir a reserva.");
                status.textContent = result.message || "Reserva excluída; senha liberada.";
                await fetchReservations();
              } catch (error) {
                window.alert(error instanceof Error ? error.message : "Não foi possível excluir a reserva.");
                deleteButton.disabled = false;
                deleteButton.textContent = "Excluir reserva";
              }
            });
            actions.append(deleteButton);
          }
          tr.append(actions); tbody.append(tr);
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
  const loadPortalSettings = async () => {
    const token = getToken();
    if (!token || role !== "admin") return;
    try {
      const url = new URL("/rest/v1/configuracoes_portal", SUPABASE_URL);
      url.searchParams.set("select", "mensagem_publica,mensagem_confirmacao,cor_primaria,cor_destaque,limite_alerta_vagas");
      url.searchParams.set("id", "eq.true");
      url.searchParams.set("limit", "1");
      const response = await fetch(url, { headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: "Bearer " + token, Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error();
      const rows = await response.json();
      if (rows[0]) for (const key of ["mensagem_publica","mensagem_confirmacao","cor_primaria","cor_destaque","limite_alerta_vagas"]) {
        const field = settingsForm.elements.namedItem(key);
        if (field && rows[0][key] != null) field.value = String(rows[0][key]);
      }
    } catch {
      settingsForm.querySelector("#portal-settings-status").textContent = "Não foi possível carregar as configurações atuais.";
    }
  };
  ordinaryReservationForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (role !== "admin" || !ordinaryReservationForm.reportValidity()) return;
    const token = getToken();
    const out = ordinaryReservationForm.querySelector("#ordinary-reservation-status");
    if (!token) { clearTeamSession(); setTeamStatus("Sessão expirada. Entre novamente."); return; }
    const payload = Object.fromEntries(new FormData(ordinaryReservationForm).entries());
    payload.preferencial = payload.preferencial === "true";
    if (!payload.preferencial) { payload.tipo_preferencial = ""; payload.descricao_preferencial = ""; }
    if (payload.retorno !== "Sim") payload.medium_nome = "";
    for (const key of ["nome_completo","data_nascimento","telefone","email","primeira_vez","tipo_preferencial","descricao_preferencial","retorno","medium_nome"]) {
      if (!payload[key]) payload[key] = null;
    }
    const submit = ordinaryReservationForm.querySelector('button[type="submit"]');
    submit.disabled = true; out.textContent = "Validando permissões, capacidade e registrando auditoria…";
    try {
      const response = await fetch(SUPABASE_URL + "/functions/v1/admin-criar-reserva", {
        method: "POST", headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(payload), cache: "no-store"
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.message || "Cadastro não concluído.");
      ordinaryReservationForm.reset(); ordinaryPreferentialWrap.hidden = true;
      ordinaryPreferentialType.required = false; ordinaryPreferentialDescription.required = false;
      out.textContent = (result.message || "Reserva administrativa registrada.") + (result.senha ? " Senha: " + result.senha : "");
      page = 1; await fetchReservations();
    } catch (error) { out.textContent = error instanceof Error ? error.message : "Cadastro não concluído."; }
    finally { submit.disabled = false; }
  });
  createGiraForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (role !== "admin" || !createGiraForm.reportValidity()) return;
    const token = getToken();
    const out = createGiraForm.querySelector("#new-gira-status");
    if (!token) { clearTeamSession(); setTeamStatus("Sessão expirada. Entre novamente."); return; }
    const data = Object.fromEntries(new FormData(createGiraForm).entries());
    data.limite_vagas = Number(data.limite_vagas);
    const submit = createGiraForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    out.textContent = "Validando permissões e cadastrando gira…";
    try {
      const response = await fetch(SUPABASE_URL + "/functions/v1/admin-giras", {
        method: "POST",
        headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(data), cache: "no-store"
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.message || "Não foi possível cadastrar a gira.");
      createGiraForm.reset();
      out.textContent = result.message || "Gira cadastrada e publicada.";
      page = 1;
      await loadPublishedGiras();
      await fetchReservations();
    } catch (error) {
      out.textContent = error instanceof TypeError
        ? "Serviço administrativo indisponível. O cadastro não foi enviado; verifique a função de giras no ambiente de homologação."
        : error instanceof Error ? error.message : "Não foi possível cadastrar a gira.";
    } finally { submit.disabled = false; }
  });
  settingsForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (role !== "admin" || !settingsForm.reportValidity()) return;
    const token = getToken();
    const status = settingsForm.querySelector("#portal-settings-status");
    if (!token) { clearTeamSession(); setTeamStatus("Sessão expirada. Entre novamente."); return; }
    const data = new FormData(settingsForm);
    const payload = Object.fromEntries(data.entries());
    payload.limite_alerta_vagas = Number(payload.limite_alerta_vagas);
    const submit = settingsForm.querySelector('button[type="submit"]');
    submit.disabled = true; status.textContent = "Validando permissões e salvando…";
    try {
      const response = await fetch(SUPABASE_URL + "/functions/v1/admin-configuracoes", {
        method: "POST", headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(payload), cache: "no-store"
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.message || "Não foi possível salvar.");
      status.textContent = result.message;
    } catch (error) { status.textContent = error instanceof Error ? error.message : "Não foi possível salvar."; }
    finally { submit.disabled = false; }
  });
  overCapacityForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (role !== "admin" || !overCapacityForm.reportValidity()) return;
    const token = getToken();
    const out = overCapacityForm.querySelector("#override-status");
    if (!token) { clearTeamSession(); setTeamStatus("Sessão expirada. Entre novamente."); return; }
    const data = new FormData(overCapacityForm);
    const payload = Object.fromEntries(data.entries());
    payload.preferencial = payload.preferencial === "true";
    if (!payload.preferencial) { payload.tipo_preferencial = ""; payload.descricao_preferencial = ""; }
    if (payload.retorno !== "Sim") payload.medium_nome = "";
    const submit = overCapacityForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    if (out) out.textContent = "Validando permissões, lotação e duplicidade…";
    try {
      const response = await fetch(SUPABASE_URL + "/functions/v1/admin-criar-excedente", {
        method: "POST",
        headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(payload), cache: "no-store"
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.message || "Cadastro não concluído.");
      overCapacityForm.reset();
      overridePreferentialWrap.hidden = true;
      if (out) out.textContent = result.message || "Cadastro registrado.";
      page = 1;
      await fetchReservations();
    } catch (error) {
      if (out) out.textContent = error instanceof Error ? error.message : "Cadastro não concluído.";
    } finally { submit.disabled = false; }
  });
  filters.addEventListener("submit", event => { event.preventDefault(); page = 1; fetchReservations(); });
  filters.addEventListener("reset", () => { page = 1; setTimeout(fetchReservations, 0); });
  const logout = document.createElement("button");
  logout.type = "button"; logout.className = "secondary-button"; logout.textContent = "Encerrar sessão";
  logout.addEventListener("click", async () => {
    const token = getToken();
    clearTeamSession(); setTeamStatus("Sessão encerrada neste navegador.");
    if (token) { try { await fetch(SUPABASE_URL + "/auth/v1/logout", { method: "POST", headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: "Bearer " + token } }); } catch { /* sessão local já encerrada */ } }
  });
  const makeAdminSection = (title, expanded = false) => {
    const section = document.createElement("details");
    section.className = "admin-section";
    section.open = expanded;
    const summary = document.createElement("summary");
    summary.textContent = title;
    const content = document.createElement("div");
    content.className = "admin-section-content";
    section.append(summary, content);
    return { section, content };
  };
  const giraSection = makeAdminSection("Agenda e cadastro de giras", true);
  giraSection.content.append(createGiraForm);
  const reservationSection = makeAdminSection("Reservas e consultas", true);
  reservationSection.content.append(filters, status, exportBar, results, pagination);
  if (role === "admin") {
    const operationsSection = makeAdminSection("Operações administrativas");
    operationsSection.content.append(ordinaryReservationForm, overCapacityForm, importForm, restoreForm, backupButton);
    const settingsSection = makeAdminSection("Configurações do portal");
    settingsSection.content.append(settingsForm);
    const dashboard = document.createElement("div");
    dashboard.className = "admin-dashboard";
    dashboard.append(giraSection.section, reservationSection.section, operationsSection.section, settingsSection.section);
    teamSession.append(heading, detail, dashboard, logout);
  } else {
    const dashboard = document.createElement("div");
    dashboard.className = "admin-dashboard";
    dashboard.append(reservationSection.section);
    teamSession.append(heading, detail, dashboard, logout);
  }
  teamSession.hidden = false;
  if (teamLoginForm) teamLoginForm.hidden = true;
  if (role === "admin") loadPortalSettings();
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
