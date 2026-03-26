import type { FastifyReply, FastifyRequest } from "fastify";

export interface ApiKeyAuthenticator {
  enabled: boolean;
  header: string;
  protectMetrics: boolean;
  protectHealth: boolean;
  authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
}

function extractProvidedKey(headerName: string, request: FastifyRequest): string | null {
  const direct = request.headers[headerName.toLowerCase()];
  if (typeof direct === "string" && direct.length > 0) {
    return direct;
  }

  const authHeader = request.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  return null;
}

export function createApiKeyAuthenticator(options: {
  enabled: boolean;
  header: string;
  protectMetrics: boolean;
  protectHealth: boolean;
  keys: Set<string>;
}): ApiKeyAuthenticator {
  return {
    enabled: options.enabled,
    header: options.header,
    protectMetrics: options.protectMetrics,
    protectHealth: options.protectHealth,
    async authenticate(request, reply) {
      if (!options.enabled) {
        return;
      }

      const providedKey = extractProvidedKey(options.header, request);
      if (!providedKey || !options.keys.has(providedKey)) {
        await reply.code(401).send({
          error: "Unauthorized",
          message: "A valid API key is required.",
        });
      }
    },
  };
}
