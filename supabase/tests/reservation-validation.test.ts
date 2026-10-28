import { assertEquals } from "jsr:@std/assert@1";
import { validateReservationInput } from "../functions/_shared/reservation-validation.ts";

const validPayload = () => ({
  gira_id: "123e4567-e89b-12d3-a456-426614174000",
  nome_completo: "Pessoa de Teste",
  data_nascimento: "1990-04-12",
  telefone: "(11) 98765-4321",
  email: "teste@example.com",
  primeira_vez: "Sim",
  preferencial: false,
  turnstile_token: "synthetic-token",
});

Deno.test("aceita payload válido sem preferência", () => {
  assertEquals(validateReservationInput(validPayload()), null);
});

Deno.test("rejeita campos inesperados", () => {
  assertEquals(validateReservationInput({ ...validPayload(), admin: true }), "Campos não reconhecidos.");
});

Deno.test("rejeita data de nascimento inexistente", () => {
  assertEquals(validateReservationInput({ ...validPayload(), data_nascimento: "2025-02-29" }), "Confira os dados informados.");
});

Deno.test("rejeita primeira_vez fora do contrato Sim/Não", () => {
  assertEquals(validateReservationInput({ ...validPayload(), primeira_vez: true }), "Preencha os campos obrigatórios.");
});

Deno.test("rejeita telefone com menos de 10 dígitos", () => {
  assertEquals(validateReservationInput({ ...validPayload(), telefone: "123-456" }), "Confira os dados informados.");
});

Deno.test("rejeita campo retorno no formulário público", () => {
  assertEquals(validateReservationInput({ ...validPayload(), retorno: "Talvez" }), "Campos não reconhecidos.");
});

Deno.test("rejeita nome de médium no formulário público", () => {
  assertEquals(validateReservationInput({ ...validPayload(), medium_nome: "Médium de Teste" }), "Campos não reconhecidos.");
});

Deno.test("exige tipo quando atendimento preferencial é solicitado", () => {
  assertEquals(validateReservationInput({ ...validPayload(), preferencial: true }), "Selecione um tipo de atendimento preferencial válido.");
});

Deno.test("exige descrição para tipo Outro", () => {
  assertEquals(validateReservationInput({ ...validPayload(), preferencial: true, tipo_preferencial: "Outro" }), "Descreva a necessidade de atendimento preferencial (até 300 caracteres).");
});

Deno.test("aceita preferência válida sem campos administrativos de retorno", () => {
  assertEquals(validateReservationInput({ ...validPayload(), preferencial: true, tipo_preferencial: "PCD" }), null);
});

Deno.test("rejeita data de nascimento futura", () => {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const futureDob = tomorrow.toISOString().slice(0, 10);
  assertEquals(validateReservationInput({ ...validPayload(), data_nascimento: futureDob }), "Confira os dados informados.");
});

Deno.test("rejeita descrição de preferência acima de 300 caracteres mesmo sem tipo Outro", () => {
  assertEquals(validateReservationInput({
    ...validPayload(),
    preferencial: false,
    descricao_preferencial: "x".repeat(301),
  }), "Confira os dados informados.");
});

Deno.test("rejeita UUID inválido da gira", () => {
  assertEquals(validateReservationInput({ ...validPayload(), gira_id: "gira-falsa" }), "Confira os dados informados.");
});

Deno.test("rejeita e-mail inválido", () => {
  assertEquals(validateReservationInput({ ...validPayload(), email: "email-invalido" }), "Confira os dados informados.");
});

Deno.test("rejeita preferência com tipo fora da lista permitida", () => {
  assertEquals(validateReservationInput({
    ...validPayload(),
    preferencial: true,
    tipo_preferencial: "VIP",
  }), "Selecione um tipo de atendimento preferencial válido.");
});

Deno.test("aceita tipo Outro com descrição válida", () => {
  assertEquals(validateReservationInput({
    ...validPayload(),
    preferencial: true,
    tipo_preferencial: "Outro",
    descricao_preferencial: "Necessidade de apoio para locomoção",
  }), null);
});

Deno.test("rejeita tipo Outro com descrição em branco", () => {
  assertEquals(validateReservationInput({
    ...validPayload(),
    preferencial: true,
    tipo_preferencial: "Outro",
    descricao_preferencial: "   ",
  }), "Descreva a necessidade de atendimento preferencial (até 300 caracteres).");
});

Deno.test("rejeita valor de preferência que não seja booleano", () => {
  assertEquals(validateReservationInput({
    ...validPayload(),
    preferencial: "não",
  }), "Informe se necessita de atendimento preferencial.");
});

Deno.test("aceita limites máximos de nome, e-mail, telefone e descrição", () => {
  const payload = {
    ...validPayload(),
    nome_completo: "N".repeat(180),
    email: "a".repeat(242) + "@example.com",
    telefone: "1".repeat(15),
    preferencial: true,
    tipo_preferencial: "Outro",
    descricao_preferencial: "x".repeat(300),
  };
  assertEquals(validateReservationInput(payload), null);
});

Deno.test("rejeita descrição de tipo Outro acima de 300 caracteres", () => {
  assertEquals(validateReservationInput({
    ...validPayload(),
    preferencial: true,
    tipo_preferencial: "Outro",
    descricao_preferencial: "x".repeat(301),
  }), "Confira os dados informados.");
});

Deno.test("aceita e-mail ausente", () => {
  const payload = validPayload();
  delete (payload as Partial<typeof payload>).email;
  assertEquals(validateReservationInput(payload), null);
});

Deno.test("aceita e-mail vazio", () => {
  assertEquals(validateReservationInput({ ...validPayload(), email: "" }), null);
});
