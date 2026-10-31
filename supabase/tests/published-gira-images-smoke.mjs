import assert from "node:assert/strict";
import { chromium } from "playwright";

const portalUrl = "https://dihjanssencoelho-svg.github.io/ReservasSenhasTEU7VD/";
const appVersion = "ff8cab37";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  // This smoke reads only the public agenda and image assets; it never opens or submits the reservation form.
  await page.route("https://challenges.cloudflare.com/**", route => route.abort());
  let cards = [];
  let scriptSrc = "";
  for (let attempt = 1; attempt <= 30; attempt++) {
    await page.goto(portalUrl + "?verify_gira_images=" + Date.now() + "_" + attempt, { waitUntil: "domcontentloaded", timeout: 45000 });
    scriptSrc = await page.locator('script[src*="/assets/app.js"]').getAttribute("src") || "";
    if (scriptSrc.includes("?v=" + appVersion)) {
      try { await page.locator("#giras-list .gira-card").first().waitFor({ state: "visible", timeout: 15000 }); } catch {}
      cards = await page.locator("#giras-list .gira-card").evaluateAll(elements => elements.map(card => ({
        title: card.querySelector("h3")?.textContent?.trim() || "",
        type: card.querySelector(".gira-card-content > .muted")?.textContent?.trim() || "",
        image: Boolean(card.querySelector(".gira-card-image img")),
        emojiPlaceholder: Boolean(card.querySelector(".gira-art"))
      })));
      if (cards.length) break;
    }
    if (attempt < 30) await page.waitForTimeout(10000);
  }
  assert.ok(scriptSrc.includes("?v=" + appVersion), "HTML publicado deve referenciar a versão nova do app.js.");
  assert.ok(cards.length > 0, "Agenda pública deve carregar ao menos um card.");
  const knownLines = ["caboclo", "preto velho", "malandro", "pombagira", "exu", "marinheiro", "ere", "crianca", "baiano", "boiadeiro", "cigano", "cirurgia espiritual", "gira pet"];
  const normalize = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const mappedCards = cards.map((card, index) => ({ ...card, index, normalized: normalize(card.title + " " + card.type) }))
    .filter(card => knownLines.some(term => card.normalized.includes(term)));
  assert.ok(mappedCards.length > 0, "Agenda precisa incluir ao menos uma linha com imagem cadastrada.");
  for (const card of mappedCards) {
    assert.equal(card.image, true, "Gira pública " + card.title + " deve renderizar imagem.");
    assert.equal(card.emojiPlaceholder, false, "Gira pública " + card.title + " não deve renderizar o placeholder antigo.");
    const image = page.locator("#giras-list .gira-card").nth(card.index).locator(".gira-card-image img");
    await image.evaluate(img => img.decode());
    assert.ok(await image.evaluate(img => img.naturalWidth > 0), "WebP pública precisa carregar: " + card.title);
  }
  console.log("OK: cards reais da agenda pública usam imagens WebP carregadas; sem envio de reservas.");
} finally {
  await browser.close();
}
