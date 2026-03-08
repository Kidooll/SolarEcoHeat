import { z } from 'zod'

export const createQuoteSchema = z.object({
  occurrence_id: z.string().uuid().optional(),
  description: z.string().min(10).max(1000),
  value: z.number().positive().max(999999.99),
})

export const updateQuoteSchema = z.object({
  description: z.string().min(10).max(1000).optional(),
  value: z.number().positive().max(999999.99).optional(),
  status: z.enum(['RASCUNHO', 'ENVIADO', 'APROVADO', 'RECUSADO']).optional(),
})

export const approveQuoteSchema = z.object({
  approved_by: z.string().uuid(),
})

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>
export type ApproveQuoteInput = z.infer<typeof approveQuoteSchema>
