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
  const submit = page.locator("#reservation-submit");
  assert.equal(await name.isDisabled(), false, "O campo de nome deveria estar liberado.");
  assert.equal(await event.isDisabled(), false, "O seletor de gira deveria estar liberado.");
  assert.equal(await submit.isDisabled(), false, "O botão de solicitação deveria estar liberado.");
  assert.equal(await submit.innerText(), "Solicitar reserva");

  // Sem token Turnstile, mesmo um submit programático não deve chamar o endpoint.
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
  await page.waitForTimeout(1000);
  assert.equal(createReservationRequests.length, 0, "Foi detectada uma chamada ao endpoint criar-reserva.");

  // Confirma que a área da equipe começa fechada, sem iniciar login ou enviar credenciais.
  assert.equal(await page.locator("#team-access").isHidden(), true, "A área restrita deveria iniciar fechada.");
  console.log("OK portal HTTP 200; formulário ativo; envio sem Turnstile bloqueado; nenhuma chamada criar-reserva; área da equipe fechada.");
} finally {
  await browser.close();
}
