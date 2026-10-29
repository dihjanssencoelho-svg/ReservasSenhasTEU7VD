import assert from "node:assert/strict";
import { chromium } from "playwright";

// Live Turnstile positive-path smoke. The outgoing request is rewritten to a
// UUID confirmed absent from the staging giras table, so the RPC must reject
// it and cannot create a reservation. Never log or persist the challenge token.
const publicUrl = "https://dihjanssencoelho-svg.github.io/ReservasSenhasTEU7VD/";
const functionUrl = "https://emwnytvlbpgiwqswojze.supabase.co/functions/v1/criar-reserva";
const fakeGiraId = "00000000-0000-4000-8000-000000000001";
let intercepted = null;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.route(functionUrl, async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.continue();
    const payload = JSON.parse(request.postData() || "{}");
    assert.equal(typeof payload.turnstile_token, "string", "O frontend não enviou o token Turnstile.");
    assert.ok(payload.turnstile_token.length > 0, "O token Turnstile está vazio.");
    payload.gira_id = fakeGiraId;
    const response = await route.fetch({ postData: JSON.stringify(payload) });
    const body = await response.text();
    intercepted = { status: response.status(), body };
    await route.fulfill({ response, body });
  });

  const response = await page.goto(publicUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  assert.equal(response?.status(), 200, "O portal público não respondeu HTTP 200.");
  await page.locator(".gira-card").first().waitFor({ state: "visible", timeout: 30000 });
  await page.locator(".gira-card").first().click();
  await page.locator("#reservation-panel").waitFor({ state: "visible" });

  // Do not bypass the widget or fabricate a token: wait for Cloudflare's real callback.
  await page.waitForFunction(
    () => document.querySelector("#turnstile-status")?.textContent?.includes("Verificação concluída"),
    null,
    { timeout: 60000 },
  );

  await page.locator("#full-name").fill("Teste automatizado Turnstile");
  await page.locator("#dob").fill("1990-01-01");
  await page.locator("#phone").fill("11987654321");
  await page.locator("#email").fill("turnstile-smoke@example.invalid");
  await page.locator("#first-time").selectOption("Não");
  await page.locator("#preferential").selectOption("false");

  const responsePromise = page.waitForResponse(
    (r) => r.url() === functionUrl && r.request().method() === "POST",
    { timeout: 30000 },
  );
  await page.locator("#reservation-submit").click();
  await responsePromise;

  assert.ok(intercepted, "A Edge Function não foi chamada.");
  const result = JSON.parse(intercepted.body);
  assert.notEqual(
    intercepted.status,
    403,
    "A Edge Function rejeitou o token: a verificação Turnstile positiva não foi comprovada.",
  );
  assert.ok(
    intercepted.status === 400 || intercepted.status === 503,
    `Esperada rejeição do UUID de gira inexistente após validar Turnstile; recebido HTTP ${intercepted.status}.`,
  );
  assert.ok(
    !String(result.message || "").toLowerCase().includes("proteção contra envios automáticos"),
    "O backend indicou falha na verificação antirobô.",
  );
  console.log(`PASSOU: token Turnstile real aceito; a Edge Function rejeitou a gira artificial inexistente (HTTP ${intercepted.status}), sem gravar reserva.`);
} finally {
  await browser.close();
}
