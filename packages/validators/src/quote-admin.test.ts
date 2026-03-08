import { describe, expect, it } from "vitest";
import { adminCreateQuoteSchema, adminQuoteStatusSchema } from "./quote-admin";

describe("adminCreateQuoteSchema", () => {
  it("valida criação básica", () => {
    const result = adminCreateQuoteSchema.safeParse({
      description: "Teste orçamento",
      value: 2500,
      materialsIncluded: false,
    });
    expect(result.success).toBe(true);
  });
});

describe("adminQuoteStatusSchema", () => {
  it("valida transição para enviado", () => {
    const result = adminQuoteStatusSchema.safeParse({
      status: "enviado",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita status inválido", () => {
    const result = adminQuoteStatusSchema.safeParse({
      status: "arquivado",
    });
    expect(result.success).toBe(false);
  });
});
