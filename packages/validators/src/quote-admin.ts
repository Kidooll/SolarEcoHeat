import { z } from "zod";

export const adminCreateQuoteSchema = z.object({
  description: z.string().min(3),
  value: z.number().positive(),
  deadlineDays: z.number().int().positive().optional(),
  materialsIncluded: z.boolean().optional(),
  occurrenceId: z.string().uuid().nullable().optional(),
});

export const adminQuoteStatusSchema = z.object({
  status: z.enum(["rascunho", "enviado", "aprovado", "recusado"]),
  finance: z
    .object({
      paymentMethod: z.enum(["pix", "boleto", "cartao", "transferencia", "dinheiro", "misto"]).optional(),
      installments: z.number().int().positive().optional(),
      entryAmount: z.number().nonnegative().optional(),
      firstDueDate: z.string().min(8).optional(),
      intervalDays: z.number().int().positive().optional(),
      notes: z.string().nullable().optional(),
    })
    .optional(),
});

export type AdminCreateQuoteInput = z.infer<typeof adminCreateQuoteSchema>;
export type AdminQuoteStatusInput = z.infer<typeof adminQuoteStatusSchema>;
