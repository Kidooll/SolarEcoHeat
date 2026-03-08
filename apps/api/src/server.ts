import "./env";
import { buildServer } from "./app";

const start = async () => {
  try {
    const server = await buildServer();
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3333;
    await server.listen({ port, host: "0.0.0.0" });
    server.log.info(`API rodando na porta ${port}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
