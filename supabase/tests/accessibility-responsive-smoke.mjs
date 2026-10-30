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
    res.writeHead(200, { "Content-Type": mime[extname(requested)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(await readFile(requested));
  } catch { res.writeHead(404); res.end("Not found"); }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.route("https://emwnytvlbpgiwqswojze.supabase.co/**", async route => {
    const u = new URL(route.request().url());
    const json = body => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (u.pathname === "/rest/v1/giras") return json([
      { id: "123e4567-e89b-12d3-a456-426614174000", titulo: "Gira de homologação", data_gira: "2027-01-15", limite_vagas: 20, tipo_gira: "Caboclos" }
    ]);
    if (u.pathname === "/rest/v1/rpc/teu7vd_configuracoes_publicas" || u.pathname === "/rest/v1/rpc/teu7vd_resumo_vagas_publico") return json([]);
    return json([]);
  });
  await page.route("https://challenges.cloudflare.com/**", route => route.abort());
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Reserva de Vagas" }).waitFor();
  await page.locator(".gira-card").waitFor();

  // Matriz de viewport: celular compacto, tablet e desktop.
  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    const metrics = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      body: document.body.scrollWidth,
      document: document.documentElement.scrollWidth
    }));
    assert.ok(metrics.body <= metrics.viewport && metrics.document <= metrics.viewport,
      `Overflow horizontal em ${viewport.width}px: ${JSON.stringify(metrics)}`);
    assert.equal(await page.locator(".site-header").isVisible(), true, "Cabeçalho deve permanecer visível em todos os tamanhos.");
    assert.equal(await page.locator(".gira-card").isVisible(), true, "Agenda deve permanecer visível em todos os tamanhos.");
  }

  // Seleção de gira acessível por teclado e foco no primeiro campo.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".gira-card").focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#reservation-panel").isVisible(), true, "Enter deve abrir o formulário a partir do card.");
  assert.equal(await page.locator("#full-name").evaluate(el => document.activeElement === el), true, "O foco deve avançar para o primeiro campo.");

  // Todos os campos visíveis do formulário devem ter nome acessível.
  for (const id of ["full-name", "dob", "phone", "email", "first-time", "preferential"]) {
    const field = page.locator(`#${id}`);
    assert.equal(await field.count(), 1, `Campo ausente: ${id}`);
    assert.ok(await field.getAttribute("aria-label") || await page.locator(`label[for="${id}"]`).count() === 1,
      `Campo sem label/nome acessível: ${id}`);
  }
  assert.equal(await page.locator("#turnstile-status").getAttribute("aria-live"), "polite",
    "O estado da verificação deve ser anunciado por tecnologia assistiva.");
  assert.equal(await page.locator("#team-login-status").getAttribute("role"), "status",
    "O estado do login administrativo deve ser anunciado.");

  // axe-core: auditoria automática WCAG 2.1 A/AA na agenda e no formulário aberto.
  await page.addScriptTag({ path: resolve("node_modules/axe-core/axe.min.js") });
  const audit = await page.evaluate(async () => window.axe.run(document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }
  }));
  const violations = audit.violations.map(v => ({
    id: v.id, impact: v.impact, description: v.help,
    nodes: v.nodes.slice(0, 5).map(n => ({ target: n.target, summary: n.failureSummary }))
  }));
  assert.equal(violations.length, 0, `axe-core encontrou violações WCAG: ${JSON.stringify(violations)}`);

  console.log("PASSOU: responsividade 360/390/768/1440px, navegação por teclado, foco, labels, anúncios de estado e axe-core WCAG 2.1 A/AA.");
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}
