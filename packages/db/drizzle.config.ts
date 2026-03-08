import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export default defineConfig({
    schema: "./src/schema.ts",
    out: "./migrations",
    driver: "pg",
    dbCredentials: {
        connectionString: process.env.SUPABASE_URL
            ? process.env.SUPABASE_URL.replace(
                "https://",
                "postgres://postgres:" + process.env.SUPABASE_SERVICE_ROLE_KEY + "@" // Ajuste manual dependendo do password do banco
            )
            : "",
    },
});
