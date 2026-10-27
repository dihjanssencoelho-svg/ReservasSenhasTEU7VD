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
  const createReservationRequests = [];
  page.on("request", (request) => {
    if (request.url().includes("/functions/v1/criar-reserva")) createReservationRequests.push(request.url());
  });
  await page.route("https://challenges.cloudflare.com/**", (route) => route.abort());
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  assert.ok(response, "O portal local não retornou resposta HTTP.");
  assert.equal(response.status(), 200, "O portal local não respondeu HTTP 200.");
  await page.getByRole("heading", { name: "Reserve sua senha" }).waitFor();

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
  console.log("OK código local de homologação: formulário ativo; envio sem Turnstile bloqueado; nenhuma chamada criar-reserva; área da equipe fechada.");
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
