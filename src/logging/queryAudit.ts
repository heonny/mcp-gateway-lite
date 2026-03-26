import type { FastifyBaseLogger } from "fastify";

import type { QueryLogLevel, RequestAudit } from "../types.js";
import { digestText } from "../utils/hash.js";

export function writeQueryAudit(
  logger: FastifyBaseLogger,
  adapterName: string,
  level: QueryLogLevel,
  audit: RequestAudit,
): void {
  if (level === "disable") {
    return;
  }

  const basePayload = {
    adapter: adapterName,
    tool: audit.tool,
    status: audit.status,
    durationMs: audit.durationMs,
    resultCount: audit.resultCount,
    errorMessage: audit.errorMessage,
  };

  if (level === "minimal") {
    logger.info(basePayload, "adapter tool audit");
    return;
  }

  if (level === "full") {
    logger.info(
      {
        ...basePayload,
        text: audit.text,
      },
      "adapter tool audit",
    );
    return;
  }

  logger.info(
    {
      ...basePayload,
      textHash: audit.text ? digestText(audit.text) : undefined,
      textLength: audit.text?.length,
    },
    "adapter tool audit",
  );
}
