import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
export { and, desc, eq, inArray, sql, sum } from "drizzle-orm";

export * from "./schema";

const connectionString = process.env.DATABASE_URL || "";
const client = postgres(connectionString);
export const db = drizzle(client, { schema });
