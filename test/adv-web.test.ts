import { describe, expect, it } from "vitest";
import { isNotFirmWebsite, pickFirmWebsite } from "@/adv/web";
import { mapFirm, type XmlNode } from "@/adv/parse";

const node = (name: string, attrs: Record<string, string> = {}, children: XmlNode[] = [], text = ""): XmlNode => ({ name, attrs, children, text });

describe("firm websites", () => {
  it("skips social media, portals and junk", () => {
    expect(isNotFirmWebsite("https://www.linkedin.com/in/someone/")).toBe(true);
    expect(isNotFirmWebsite("HTTPS://TWITTER.COM/firm")).toBe(true);
    expect(isNotFirmWebsite("facebook.com/firm")).toBe(true);
    expect(isNotFirmWebsite("https://firm.portal.tamaracinc.com")).toBe(true);
    expect(isNotFirmWebsite("not a url")).toBe(true);
    expect(isNotFirmWebsite("HTTPS://WWW.STEVENGBLUM.COM/")).toBe(false);
    expect(isNotFirmWebsite("examplelinkedin.com")).toBe(false);
  });

  it("picks the first address that is the firm's own site", () => {
    expect(pickFirmWebsite(["https://www.linkedin.com/company/x", null, "https://x-planning.com"])).toBe("https://x-planning.com");
    expect(pickFirmWebsite(["https://www.linkedin.com/in/matt/"])).toBeNull();
  });

  it("is applied when mapping a firm from the feed", () => {
    const firm = node("Firm", {}, [
      node("Info", { FirmCrdNb: "283698", BusNm: "Example" }),
      node("WebAddrs", {}, [node("WebAddr", {}, [], "https://www.linkedin.com/in/someone/"), node("WebAddr", {}, [], "https://example-wealth.com")]),
    ]);
    expect(mapFirm(firm).website).toBe("https://example-wealth.com");
  });
});
