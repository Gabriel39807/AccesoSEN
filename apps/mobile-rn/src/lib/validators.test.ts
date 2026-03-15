import { describe, expect, it } from "vitest";

import {
  isSignedScanToken,
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

  it("rejects invalid manual scan values", () => {
    expect(validateScanValue("123")).toBe("El documento debe tener entre 6 y 10 digitos.");
    expect(validateDocument6to10("abcd")).toBe("El documento debe tener entre 6 y 10 digitos.");
  });

  it("enforces 10-digit phone numbers", () => {
    expect(validatePhone10("3001234567")).toBeNull();
    expect(validatePhone10("30012")).toBe("El telefono debe tener exactamente 10 digitos.");
  });
});
