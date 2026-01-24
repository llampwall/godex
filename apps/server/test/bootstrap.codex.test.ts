import { describe, expect, test } from "vitest";
import { resolveTemplateWithCodex } from "../src/bootstrap";

describe("codex template selection (integration)", () => {
  const timeoutMs = 120_000;

  test(
    "python for scraping tool",
    async () => {
      const decision = await resolveTemplateWithCodex(
        "test-scraper",
        "an app that scrapes football statistics from several sports sites"
      );
      expect(decision.template_used).toBe("python");
    },
    timeoutMs
  );

  test(
    "service for backend api",
    async () => {
      const decision = await resolveTemplateWithCodex(
        "test-api",
        "a backend-only API service that ingests webhooks and queues jobs"
      );
      expect(decision.template_used).toBe("service");
    },
    timeoutMs
  );

  test(
    "web for marketing site",
    async () => {
      const decision = await resolveTemplateWithCodex(
        "test-landing",
        "a simple marketing landing page with no backend or database"
      );
      expect(decision.template_used).toBe("web");
    },
    timeoutMs
  );

  test(
    "mono for fullstack app",
    async () => {
      const decision = await resolveTemplateWithCodex(
        "test-dashboard",
        "a fullstack web app with an admin dashboard and backend API"
      );
      expect(decision.template_used).toBe("mono");
    },
    timeoutMs
  );
});
