import assert from "node:assert/strict";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const root = resolve(".");
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".webp": "image/webp" };
const publicGiras = [
  { id: "123e4567-e89b-12d3-a456-426614174000", titulo: "Caboclos 🌿", data_gira: "2026-11-06", limite_vagas: 80, tipo_gira: "Trabalho" },
  { id: "223e4567-e89b-12d3-a456-426614174000", titulo: "(Dom) - Gira Pet 🐈🐕 das 10h00 às 12h00", data_gira: "2026-11-08", limite_vagas: 40, tipo_gira: "Trabalho" },
  { id: "423e4567-e89b-12d3-a456-426614174000", titulo: "Pretos velhos ☕", data_gira: "2026-11-13", limite_vagas: 80, tipo_gira: "Trabalho" }
];
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    if (pathname.startsWith("/rest/v1/")) {
      const body = pathname === "/rest/v1/giras" ? publicGiras : [];
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(body));
      return;
    }
    const requested = resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    if (requested !== root && !requested.startsWith(root + sep)) throw new Error("invalid path");
    res.writeHead(200, { "Content-Type": mime[extname(requested)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(await readFile(requested));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise(resolveListen => server.listen(0, "127.0.0.1", resolveListen));
const address = server.address();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.route("https://challenges.cloudflare.com/**", route => route.abort());
  await page.route("https://emwnytvlbpgiwqswojze.supabase.co/**", route => {
    const path = new URL(route.request().url()).pathname;
    const body = path === "/rest/v1/giras" ? publicGiras : [];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("http://127.0.0.1:" + address.port + "/", { waitUntil: "domcontentloaded" });
  const cards = page.locator("#giras-list .gira-card");
  await cards.first().waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await cards.count(), 3);
  const expected = ["assets/caboclos.webp", "assets/gira-pet.webp", "assets/pretos-velhos.webp"];
  for (let i = 0; i < expected.length; i++) {
    const image = cards.nth(i).locator(".gira-card-image img");
    assert.equal(await image.getAttribute("src"), expected[i], "Título público da gira deve selecionar a WebP correta.");
    await image.evaluate(img => img.decode());
    assert.ok(await image.evaluate(img => img.naturalWidth > 0), "A WebP precisa decodificar no navegador.");
  }
  assert.equal(await page.locator(".gira-art").count(), 0, "Cards cobertos por imagens não devem voltar aos emojis.");
  console.log("OK: títulos públicos reais + tipo_gira genérico Trabalho renderizam e decodificam as WebP.");
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
