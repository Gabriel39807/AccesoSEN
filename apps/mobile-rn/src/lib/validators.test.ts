import { describe, expect, it } from "vitest";

import {
  isSignedScanToken,
  normalizeScanValue,
  sanitizeDigits,
  validateDocument6to10,
  validatePhone10,
  validateScanValue,
} from "./validators";

describe("mobile validators smoke", () => {
  it("sanitizes document input to digits only", () => {
    expect(sanitizeDigits("CC 12.345-678")).toBe("12345678");
  });

  it("accepts signed QR tokens without document validation", () => {
    expect(isSignedScanToken("SADI1B64:abc123")).toBe(true);
    expect(validateScanValue("SADI1:payload")).toBeNull();
  });

  it("preserves full signed scan tokens during scanner normalization", () => {
    expect(normalizeScanValue("  SADI1B64:abc.DEF_123-xyz  ")).toBe("SADI1B64:abc.DEF_123-xyz");
  });

  it("preserves full signed scan tokens during manual input normalization", () => {
    expect(normalizeScanValue("SADI1:manual-token-XYZ")).toBe("SADI1:manual-token-XYZ");
  });

  it("keeps numeric documents compatible during scan normalization", () => {
    expect(normalizeScanValue("CC 12.345-678")).toBe("12345678");
    expect(normalizeScanValue("  1234567890123  ")).toBe("1234567890");
  });

  it("rejects invalid manual scan values", () => {
    expect(validateScanValue("123")).toBe("El documento debe tener entre 6 y 10 dígitos.");
    expect(validateDocument6to10("abcd")).toBe("El documento debe tener entre 6 y 10 dígitos.");
  });

  it("enforces 10-digit phone numbers", () => {
    expect(validatePhone10("3001234567")).toBeNull();
    expect(validatePhone10("30012")).toBe("El teléfono debe tener exactamente 10 dígitos.");
  });
});
