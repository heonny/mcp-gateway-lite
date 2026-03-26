import type { FastifyReply, FastifyRequest } from "fastify";

export interface ApiKeyAuthenticator {
  enabled: boolean;
  protectMetrics: boolean;
  protectHealth: boolean;
  authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
}

function extractBearerToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  return null;
}

export function createApiKeyAuthenticator(options: {
  enabled: boolean;
  protectMetrics: boolean;
  protectHealth: boolean;
  token: string | null;
}): ApiKeyAuthenticator {
  return {
    enabled: options.enabled,
    protectMetrics: options.protectMetrics,
    protectHealth: options.protectHealth,
    async authenticate(request, reply) {
      if (!options.enabled) {
        return;
      }

      const providedToken = extractBearerToken(request);
      if (!providedToken || !options.token || providedToken !== options.token) {
        await reply.code(401).send({
          error: "Unauthorized",
          message: "A valid bearer token is required.",
        });
      }
    },
  };
}
