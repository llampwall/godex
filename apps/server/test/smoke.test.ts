import { describe, expect, it } from "vitest";
import { buildServer } from "../src/server";

const token = "test-token";

describe("smoke", () => {
  it("responds on /health", async () => {
    process.env.CODEX_RELAY_TOKEN = token;
    const app = buildServer();
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.pid).toBe("number");
    expect(typeof body.uptime).toBe("number");
    expect(typeof body.active_runs).toBe("number");
  });
});
