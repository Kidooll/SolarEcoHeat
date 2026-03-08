import { z } from 'zod'

export const createOccurrenceSchema = z.object({
  system_id: z.string().uuid(),
  attendance_id: z.string().uuid().optional(),
  description: z.string().min(10).max(1000),
  severity: z.enum(['OK', 'ATENÇÃO', 'CRÍTICO']),
})

export const updateOccurrenceSchema = z.object({
  description: z.string().min(10).max(1000).optional(),
  severity: z.enum(['OK', 'ATENÇÃO', 'CRÍTICO']).optional(),
  status: z.string().max(20).optional(),
})

export type CreateOccurrenceInput = z.infer<typeof createOccurrenceSchema>
export type UpdateOccurrenceInput = z.infer<typeof updateOccurrenceSchema>
