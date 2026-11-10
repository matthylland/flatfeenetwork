import { describe, expect, it } from "vitest";
import { emailMatchesWebsite } from "@/claims";

describe("emailMatchesWebsite", () => {
  it("matches the firm's own domain, with or without www or a scheme", () => {
    expect(emailMatchesWebsite("Jo@ExamplePlanning.com", "HTTPS://WWW.EXAMPLEPLANNING.COM/")).toBe(true);
    expect(emailMatchesWebsite("jo@exampleplanning.com", "exampleplanning.com")).toBe(true);
    expect(emailMatchesWebsite("jo@mail.exampleplanning.com", "https://exampleplanning.com")).toBe(true);
  });

  it("never matches webmail, shared hosts or other domains", () => {
    expect(emailMatchesWebsite("jo@gmail.com", "https://gmail.com")).toBe(false);
    expect(emailMatchesWebsite("jo@linkedin.com", "https://www.linkedin.com/company/x")).toBe(false);
    expect(emailMatchesWebsite("jo@otherfirm.com", "https://exampleplanning.com")).toBe(false);
    expect(emailMatchesWebsite("jo@notexampleplanning.com", "https://exampleplanning.com")).toBe(false);
    expect(emailMatchesWebsite("jo@exampleplanning.com", null)).toBe(false);
  });
});
