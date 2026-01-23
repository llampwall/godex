import { FastifyReply, FastifyRequest } from "fastify";

const getTokenFromAuthHeader = (req: FastifyRequest): string | null => {
  const header = req.headers.authorization;
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
};

const getTokenFromQuery = (req: FastifyRequest): string | null => {
  const query = req.query as Record<string, unknown> | undefined;
  const token = query?.token;
  if (typeof token !== "string" || !token.trim()) return null;
  return token.trim();
};

const isPublicPath = (url?: string) => {
  if (!url) return false;
  return url.startsWith("/ui") || url.startsWith("/assets") || url.startsWith("/favicon") || url.startsWith("/robots");
};

export const authGuard = async (req: FastifyRequest, reply: FastifyReply) => {
  if (req.method === "OPTIONS") return;
  if (isPublicPath(req.raw.url)) return;
  const expected = process.env.CODEX_RELAY_TOKEN;
  if (!expected) {
    reply.code(500).send({ ok: false, error: "CODEX_RELAY_TOKEN missing" });
    return;
  }
  const token = getTokenFromAuthHeader(req) ?? getTokenFromQuery(req);
  if (!token || token !== expected) {
    reply.code(401).send({ ok: false, error: "unauthorized" });
    return;
  }
};
