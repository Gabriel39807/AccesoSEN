import { beforeEach, describe, expect, it, vi } from "vitest";

const postMock = vi.fn();
const getMock = vi.fn();
const saveTokensMock = vi.fn();
const setBiometricEnabledMock = vi.fn();
const getOrCreateDeviceIdMock = vi.fn();
const isBiometricAvailableMock = vi.fn();

vi.mock("./client", () => ({
  api: {
    post: postMock,
    get: getMock,
  },
  refreshAccessToken: vi.fn(),
}));

vi.mock("../storage/tokens", () => ({
  getOrCreateDeviceId: getOrCreateDeviceIdMock,
  saveTokens: saveTokensMock,
  setBiometricEnabled: setBiometricEnabledMock,
}));

vi.mock("../auth/biometric", () => ({
  isBiometricAvailable: isBiometricAvailableMock,
}));

describe("mobile auth smoke", () => {
  beforeEach(() => {
    postMock.mockReset();
    getMock.mockReset();
    saveTokensMock.mockReset();
    setBiometricEnabledMock.mockReset();
    getOrCreateDeviceIdMock.mockReset();
    isBiometricAvailableMock.mockReset();

    getOrCreateDeviceIdMock.mockResolvedValue("device-123");
    isBiometricAvailableMock.mockResolvedValue(false);
  });

  it("submits login payload with expected role and stores tokens", async () => {
    postMock.mockResolvedValueOnce({
      data: { access: "access-1", refresh: "refresh-1" },
    });

    const { login } = await import("./auth");
    const result = await login("guarda.demo", "Segura123", "guarda");

    expect(postMock).toHaveBeenCalledWith("/api/auth/login/", {
      username: "guarda.demo",
      password: "Segura123",
      device_id: "device-123",
      expected_role: "guarda",
    });
    expect(saveTokensMock).toHaveBeenCalledWith("access-1", "refresh-1");
    expect(setBiometricEnabledMock).not.toHaveBeenCalled();
    expect(result).toEqual({ access: "access-1", refresh: "refresh-1" });
  });

  it("falls back to token endpoint when login endpoint is unavailable", async () => {
    postMock
      .mockRejectedValueOnce({ response: { status: 404 } })
      .mockResolvedValueOnce({ data: { access: "access-2", refresh: "refresh-2" } });

    const { login } = await import("./auth");
    await login("aprendiz.demo", "Clave123", "aprendiz");

    expect(postMock).toHaveBeenNthCalledWith(1, "/api/auth/login/", {
      username: "aprendiz.demo",
      password: "Clave123",
      device_id: "device-123",
      expected_role: "aprendiz",
    });
    expect(postMock).toHaveBeenNthCalledWith(2, "/api/token/", {
      username: "aprendiz.demo",
      password: "Clave123",
      device_id: "device-123",
      expected_role: "aprendiz",
    });
  });

  it("enables biometric flow after first successful login when available", async () => {
    postMock.mockResolvedValueOnce({
      data: { access: "access-3", refresh: "refresh-3" },
    });
    isBiometricAvailableMock.mockResolvedValueOnce(true);

    const { login } = await import("./auth");
    await login("superadmin", "Segura123", "admin");

    expect(setBiometricEnabledMock).toHaveBeenCalledWith(true);
  });
});
