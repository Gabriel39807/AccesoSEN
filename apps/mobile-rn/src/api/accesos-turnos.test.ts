import { beforeEach, describe, expect, it, vi } from "vitest";

const postMock = vi.fn();
const getMock = vi.fn();

vi.mock("./client", () => ({
  api: {
    post: postMock,
    get: getMock,
  },
}));

describe("mobile access and turno smoke", () => {
  beforeEach(() => {
    postMock.mockReset();
    getMock.mockReset();
  });

  it("normalizes approved equipment payload and exposes current state", async () => {
    postMock.mockResolvedValueOnce({
      data: {
        estado: "dentro",
        aprendiz: { id: 1, username: "aprendiz.demo", first_name: "Ana", last_name: "Lopez", documento: "12345678" },
        equipos: [{ id: 10, serial: "ABC", marca: "Dell", modelo: "Latitude" }],
        turno: { id: 99, sede: "norte", jornada: "MANANA" },
      },
    });

    const { validarDocumento } = await import("./accesos");
    const result = await validarDocumento("SADI1B64:qr-firmado");

    expect(postMock).toHaveBeenCalledWith("/api/accesos/validar_documento/", {
      documento: "SADI1B64:qr-firmado",
    });
    expect(result.estado).toBe("dentro");
    expect(result.equipos_aprobados).toEqual([{ id: 10, serial: "ABC", marca: "Dell", modelo: "Latitude" }]);
  });

  it("sends document access registration payload with tipo, equipos and idempotency key", async () => {
    postMock.mockResolvedValueOnce({ data: { permitido: true } });

    const { createRegistroIdempotencyKey, registrarPorDocumento } = await import("./accesos");
    const idempotencyKey = createRegistroIdempotencyKey("12345678", "ingreso");
    await registrarPorDocumento({
      documento: "12345678",
      tipo: "ingreso",
      equipos: [10, 11],
    }, { idempotencyKey });

    expect(postMock).toHaveBeenCalledWith("/api/accesos/registrar_por_documento/", {
      documento: "12345678",
      tipo: "ingreso",
      equipos: [10, 11],
    }, {
      headers: { "X-Idempotency-Key": idempotencyKey },
    });
  });

  it("starts and finishes turno against the expected endpoints", async () => {
    postMock
      .mockResolvedValueOnce({
        data: {
          permitido: true,
          motivo: null,
          turno: { id: 7, guarda: 2, sede: "norte", jornada: "MANANA", inicio: "2026-03-15T10:00:00Z", fin: null, activo: true },
        },
      })
      .mockResolvedValueOnce({
        data: {
          permitido: true,
          motivo: null,
          turno: null,
        },
      });

    const { iniciarTurno, finalizarTurno } = await import("./turnos");
    const started = await iniciarTurno("norte", "MANANA" as any);
    const finished = await finalizarTurno();

    expect(postMock).toHaveBeenNthCalledWith(1, "/api/turnos/iniciar/", {
      sede: "norte",
      jornada: "MANANA",
    });
    expect(postMock).toHaveBeenNthCalledWith(2, "/api/turnos/finalizar/");
    expect(started.turno.activo).toBe(true);
    expect(finished.turno).toBeNull();
  });
});
