import { describe, expect, it } from "vitest";

import { validateRedisCommand } from "../src/adapters/redisGuards.js";
import { validateReadOnlySql } from "../src/adapters/sqlGuards.js";

describe("validateReadOnlySql", () => {
  it("allows read-only select queries", () => {
    expect(() => validateReadOnlySql("SELECT * FROM users")).not.toThrow();
  });

  it("blocks multi-statement sql", () => {
    expect(() => validateReadOnlySql("SELECT 1; SELECT 2")).toThrow("Multiple SQL statements");
  });

  it("blocks write statements", () => {
    expect(() => validateReadOnlySql("DELETE FROM users")).toThrow("Only read-only SQL statements");
  });
});

describe("validateRedisCommand", () => {
  it("allows allowlisted commands", () => {
    expect(validateRedisCommand("GET sample:key")).toEqual(["GET", "sample:key"]);
  });

  it("blocks write commands", () => {
    expect(() => validateRedisCommand("SET sample:key value")).toThrow("allowlist");
  });
});
