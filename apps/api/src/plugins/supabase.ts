import fp from "fastify-plugin";
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL and Anon Key are required in environment variables.");
}

// Instância para ser usada pelo backend para consultar dados com o RLS em mente (precisa repassar o token JWT do user para a instância para a query de DB pegar a context)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Define type estendido do request para injetar o user
declare module "fastify" {
    interface FastifyRequest {
        user?: any;
        token?: string;
    }
    interface FastifyInstance {
        authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
}

const supabaseAuth: FastifyPluginAsync = async (fastify, options) => {
    fastify.decorate("authenticate", async function (request: FastifyRequest, reply: FastifyReply) {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader) {
                throw new Error("Missing Authorization header");
            }

            const token = authHeader.replace("Bearer ", "");
            const { data: { user }, error } = await supabase.auth.getUser(token);

            if (error || !user) {
                throw new Error("Invalid or expired token");
            }

            // Injetamos o user e o token na request
            request.user = user;
            request.token = token;

        } catch (err) {
            reply.code(401).send({ error: "Unauthorized", details: err instanceof Error ? err.message : "Unknown error" });
        }
    });
};

export const supabaseAuthPlugin = fp(supabaseAuth);
