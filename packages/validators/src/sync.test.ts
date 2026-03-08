import { describe, expect, it } from "vitest";
import { syncPushSchema } from "./sync";

describe("syncPushSchema", () => {
  it("aceita payload válido", () => {
    const result = syncPushSchema.safeParse({
      schemaVersion: 1,
      operations: [
        {
          localId: 10,
          type: "UPDATE",
          entity: "attendance",
          data: { id: "abc" },
          timestamp: Date.now(),
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejeita schemaVersion negativo", () => {
    const result = syncPushSchema.safeParse({
      schemaVersion: -1,
      operations: [],
    });

    expect(result.success).toBe(false);
  });
});
