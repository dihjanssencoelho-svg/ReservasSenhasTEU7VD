/*
 * Portal TEU7VD - primeira etapa de homologação.
 * Não coleta nem grava dados nesta versão.
 *
 * Depois de criar o Supabase:
 * - usar apenas Project URL e chave pública (anon/publishable) no frontend;
 * - nunca inserir service_role/secret no navegador ou no repositório;
 * - liberar a reserva somente após RPC transacional e RLS revisadas.
 */
const SUPABASE_URL = "";
const SUPABASE_PUBLIC_KEY = "";

const configMessage = document.getElementById("config-message");
if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY) {
  configMessage.textContent =
    "Ambiente não conectado ao Supabase. Reservas desativadas; nenhum dado pessoal será gravado.";
}

const form = document.getElementById("reservation-form");
form?.addEventListener("submit", (event) => {
  event.preventDefault();
  // Intencionalmente sem implementação nesta etapa.
});