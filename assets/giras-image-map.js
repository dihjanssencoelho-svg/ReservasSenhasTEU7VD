/* TEU7VD — resolução resiliente de imagens por linha de trabalho.
 * A identificação usa titulo + tipo_gira normalizados; mudanças cosméticas
 * no nome do card não quebram a associação da imagem.
 */
const GIRAS_IMAGE_RULES = [
  { key: "pombagiras-exus", terms: ["pombagiras e exus", "pombagira e exu", "exus e pombagiras", "exus pombagiras"] },
  { key: "exus-mirim-pombagiras-mirim", terms: ["exu mirim", "exus mirins", "pombagira mirim", "pombagiras mirins"] },
  { key: "pretos-velhos", terms: ["preto velho", "pretos velhos", "preta velha", "pretas velhas"] },
  { key: "caboclos", terms: ["caboclo", "caboclos", "cabocla", "caboclas"] },
  { key: "malandros", terms: ["malandro", "malandros", "malandra", "malandras"] },
  { key: "pombagiras", terms: ["pombagira", "pombagiras"] },
  { key: "exus", terms: ["exu", "exus"] },
  { key: "marinheiros", terms: ["marinheiro", "marinheiros"] },
  { key: "eres", terms: ["ere", "eres", "crianças", "linha das crianças"] },
  { key: "baianos", terms: ["baiano", "baianos", "baiana", "baianas"] },
  { key: "boiadeiros", terms: ["boiadeiro", "boiadeiros", "boiadeira", "boiadeiras"] },
  { key: "ciganos", terms: ["cigano", "ciganos", "cigana", "ciganas"] },
  { key: "cirurgia-espiritual", terms: ["cirurgia espiritual", "cirurgias espirituais"] },
  { key: "gira-pet", terms: ["gira pet", "giras pet", "pet"] }
];
const normalizeGiraName = (value = "") => String(value)
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function resolveGiraImage(gira) {
  const haystack = normalizeGiraName(`${gira?.titulo || ""} ${gira?.tipo_gira || ""}`);
  const rule = GIRAS_IMAGE_RULES.find(({terms}) => terms.some(term => {
    const normalized = normalizeGiraName(term);
    return (` ${haystack} `).includes(` ${normalized} `);
  }));
  return rule ? `assets/giras/${rule.key}.webp` : null;
}
