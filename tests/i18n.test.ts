import { describe, expect, it } from "vitest";
import {
  detectDefaultLocale,
  getMessages,
  normalizeLocale,
  SUPPORTED_LOCALES,
} from "../src/i18n/messages.js";

describe("i18n messages", () => {
  it("detects supported browser locales and falls back to English", () => {
    expect(detectDefaultLocale("en-US")).toBe("en");
    expect(detectDefaultLocale("es-AR")).toBe("es");
    expect(detectDefaultLocale("es")).toBe("es");
    expect(detectDefaultLocale("zh-CN")).toBe("zh");
    expect(detectDefaultLocale("zh-TW")).toBe("zh");
    expect(detectDefaultLocale("fr-FR")).toBe("en");
    expect(detectDefaultLocale("ja-JP")).toBe("en");
  });

  it("normalizes persisted locale values safely", () => {
    expect(normalizeLocale("es", "en-US")).toBe("es");
    expect(normalizeLocale("zh", "en-US")).toBe("zh");
    expect(normalizeLocale("en", "es-ES")).toBe("en");
    expect(normalizeLocale(null, "zh-CN")).toBe("zh");
    expect(normalizeLocale("invalid", "es-MX")).toBe("es");
  });

  it("provides non-empty localized copy for all supported locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const msg = getMessages(locale);
      for (const value of Object.values(msg)) {
        expect(value.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
