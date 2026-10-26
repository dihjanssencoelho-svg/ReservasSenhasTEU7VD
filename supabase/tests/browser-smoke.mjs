import { chromium } from "playwright";
import assert from "node:assert/strict";

const url = "https://dihjanssencoelho-svg.github.io/ReservasSenhasTEU7VD/";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const createReservationRequests = [];
  page.on("request", (request) => {
    if (request.url().includes("/functions/v1/criar-reserva")) {
      createReservationRequests.push(request.url());
    }
  });

  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  assert.ok(response, "A página não retornou resposta HTTP.");
  assert.equal(response.status(), 200, "O portal público não respondeu HTTP 200.");
  await assert.doesNotReject(() => page.getByRole("heading", { name: "Reserve sua senha" }).waitFor());

  const name = page.locator("#full-name");
  const event = page.locator("#event");
  const submit = page.locator("#reservation-form button[type='button']");
  assert.equal(await name.isDisabled(), true, "O campo de nome deveria estar desabilitado.");
  assert.equal(await event.isDisabled(), true, "O seletor de gira deveria estar desabilitado.");
  assert.equal(await submit.isDisabled(), true, "O botão de reserva deveria estar desabilitado.");
  assert.equal(await submit.innerText(), "Reservas ainda não liberadas");

  // Tentativa de disparo programático: o listener deve bloquear e nenhuma chamada de reserva pode ocorrer.
  await page.locator("#reservation-form").evaluate((form) => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  await page.waitForTimeout(1000);
  assert.equal(createReservationRequests.length, 0, "Foi detectada uma chamada ao endpoint criar-reserva.");

  // Confirma que a área da equipe começa fechada, sem iniciar login ou enviar credenciais.
  assert.equal(await page.locator("#team-access").isHidden(), true, "A área restrita deveria iniciar fechada.");
  console.log("OK portal HTTP 200; formulário bloqueado; nenhuma chamada criar-reserva; área da equipe fechada.");
} finally {
  await browser.close();
}
