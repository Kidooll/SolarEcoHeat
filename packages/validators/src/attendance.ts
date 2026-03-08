import { z } from 'zod'

export const createAttendanceSchema = z.object({
  unit_id: z.string().uuid(),
  type: z.string().min(1).max(50),
  notes: z.string().max(1000).optional(),
})

export const updateAttendanceSchema = z.object({
  status: z.enum(['AGENDADO', 'EM_ANDAMENTO', 'FINALIZADO', 'CANCELADO']).optional(),
  started_at: z.string().datetime().optional(),
  finished_at: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
})

export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>
