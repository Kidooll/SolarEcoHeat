import { z } from "zod";

export const syncOperationSchema = z.object({
  localId: z.number().int().positive().optional(),
  type: z.enum(["CREATE", "UPDATE", "DELETE"]),
  entity: z.enum(["attendance", "occurrence", "system"]),
  data: z.record(z.any()),
  timestamp: z.number().int().positive().optional(),
});

export const syncPushSchema = z.object({
  schemaVersion: z.number().int().min(0),
  operations: z.array(syncOperationSchema),
});

export type SyncPushInput = z.infer<typeof syncPushSchema>;
