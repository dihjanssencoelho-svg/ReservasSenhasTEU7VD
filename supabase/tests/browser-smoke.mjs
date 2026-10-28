import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const root = resolve(".");
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    const requested = resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    if (requested !== root && !requested.startsWith(root + sep)) throw new Error("invalid path");
    const body = await readFile(requested);
    res.writeHead(200, { "Content-Type": mime[extname(requested)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
});
await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const address = server.address();
const url = `http://127.0.0.1:${address.port}/`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  let giraPayload = null;
  await page.route("https://emwnytvlbpgiwqswojze.supabase.co/**", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (requestUrl.pathname === "/auth/v1/token") {
      return json({ access_token: "mock-admin-token", refresh_token: "mock-refresh-token", expires_in: 3600, user: { id: "123e4567-e89b-12d3-a456-426614174000", email: "admin@example.invalid" } });
    }
    if (requestUrl.pathname === "/rest/v1/perfis_admin") {
      return json([{ user_id: "123e4567-e89b-12d3-a456-426614174000", papel: "admin", ativo: true }]);
    }
    if (requestUrl.pathname === "/rest/v1/giras" || requestUrl.pathname === "/rest/v1/rpc/teu7vd_resumo_vagas_publico") return json([]);
    if (requestUrl.pathname === "/rest/v1/configuracoes_portal") {
      return json([{ mensagem_publica: "Mensagem de teste", mensagem_confirmacao: "Confirmação de teste", cor_primaria: "#17131e", cor_destaque: "#c9a86a", limite_alerta_vagas: 5 }]);
    }
    if (requestUrl.pathname === "/functions/v1/listar-reservas") {
      return json({ success: true, role: "admin", data: [], giras: [], total: 0, page: 1, page_size: 25 });
    }
    if (requestUrl.pathname === "/functions/v1/admin-giras") {
      giraPayload = JSON.parse(request.postData() || "{}");
      return json({ success: true, gira_id: "223e4567-e89b-12d3-a456-426614174000", message: "Gira cadastrada e publicada com 12 senhas disponíveis." });
    }
    return json({ success: false, message: "Unexpected mocked request" }, 404);
  });
  const createReservationRequests = [];
  page.on("request", (request) => {
    if (request.url().includes("/functions/v1/criar-reserva")) createReservationRequests.push(request.url());
  });
  await page.route("https://challenges.cloudflare.com/**", (route) => route.abort());
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  assert.ok(response, "O portal local não retornou resposta HTTP.");
  assert.equal(response.status(), 200, "O portal local não respondeu HTTP 200.");
  await page.getByRole("heading", { name: "Reserva de Vagas" }).waitFor();

  const name = page.locator("#full-name");
  const event = page.locator("#event");
  const submit = page.locator("#reservation-submit");
  assert.equal(await name.isDisabled(), false, "O campo de nome deveria estar liberado no código de homologação.");
  assert.equal(await event.isDisabled(), false, "O seletor de gira deveria estar liberado no código de homologação.");
  assert.equal(await submit.isDisabled(), false, "O botão de solicitação deveria estar liberado no código de homologação.");
  assert.equal(await submit.innerText(), "Solicitar reserva");

  // Sem token Turnstile, mesmo um submit válido programático não deve chamar a Edge Function.
  await page.locator("#reservation-form").evaluate((form) => {
    form.querySelector("#full-name").value = "Pessoa de teste";
    form.querySelector("#event").innerHTML = '<option value="123e4567-e89b-12d3-a456-426614174000">Gira de teste</option>';
    form.querySelector("#event").value = "123e4567-e89b-12d3-a456-426614174000";
    form.querySelector("#dob").value = "1990-04-12";
    form.querySelector("#phone").value = "11987654321";
    form.querySelector("#email").value = "teste@example.com";
    form.querySelector("#first-time").value = "Sim";
    form.querySelector("#preferential").value = "false";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(300);
  assert.equal(createReservationRequests.length, 0, "Foi detectada chamada sem Turnstile ao endpoint criar-reserva.");
  assert.match(await page.locator("#turnstile-status").innerText(), /Conclua a verificação antirobô/);

  assert.equal(await page.locator("#team-access").isHidden(), true, "A área restrita deveria iniciar fechada.");
  const accessToggle = page.locator("#team-access-toggle");
  await accessToggle.click();
  await page.locator("#team-email").fill("admin@example.invalid");
  await page.locator("#team-password").fill("mock-password");
  await page.locator("#team-login-submit").click();
  await page.getByRole("heading", { name: "Área administrativa — Administrador" }).waitFor();
  assert.equal(await page.locator("#new-gira-title").isVisible(), true, "O administrador deveria poder cadastrar novas giras.");
  assert.equal(await page.locator("#new-gira-capacity").getAttribute("type"), "number");
  assert.equal(await page.locator("#new-gira-capacity").getAttribute("min"), "1");
  await page.locator("#new-gira-title").fill("Gira de teste");
  await page.locator("#new-gira-date").fill("2027-01-15");
  await page.locator("#new-gira-type").fill("Caboclos");
  await page.locator("#new-gira-capacity").fill("12");
  await page.getByRole("button", { name: "Cadastrar gira" }).click();
  await page.getByText("Gira cadastrada e publicada com 12 senhas disponíveis.").waitFor();
  assert.deepEqual(giraPayload, { titulo: "Gira de teste", data_gira: "2027-01-15", tipo_gira: "Caboclos", limite_vagas: 12 });

  console.log("OK código local de homologação: formulário público ativo; envio sem Turnstile bloqueado; admin autenticado vê e envia cadastro de gira com capacidade; chamadas administrativas mockadas.");
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
