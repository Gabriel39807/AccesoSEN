import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Picker } from "@react-native-picker/picker";

import { useSessionStore } from "../../store/session";
import { toUiErrorMessage } from "../../api/client";
import { Jornada, Sede } from "../../api/turnos";
import { listSedes, type SedeItem } from "../../api/sedes";
import { sanitizeDigits, validateDocument6to10 } from "../../lib/validators";
import { FadeInCard, InputField, ModernButton, ModernScreen, NoticeBanner, Pill, TitleBlock } from "../../ui/modern";
import { useSystemBranding } from "../../theme/system-branding";

export function GuardLoginScreen() {
  const signInGuarda = useSessionStore((s) => s.signInGuarda);
  const { config } = useSystemBranding();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [sede, setSede] = useState<Sede>("");
  const [sedes, setSedes] = useState<SedeItem[]>([]);
  const [jornada, setJornada] = useState<Jornada>("TARDE");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const items = await listSedes();
        if (!mounted) return;
        setSedes(items);
        if (items.length > 0) setSede(items[0].code);
      } catch {
        if (!mounted) return;
        setSedes([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function onUsernameChange(value: string) {
    setUsername(sanitizeDigits(value).slice(0, 10));
  }

  function onPasswordChange(value: string) {
    setPassword(value.slice(0, 20));
  }

  async function onSubmit() {
    setError(null);
    const documentError = validateDocument6to10(username.trim());
    if (documentError) {
      setError(documentError);
      return;
    }
    if (!password || password.length > 20) {
      setError("La contraseña debe tener máximo 20 caracteres.");
      return;
    }
    if (!sede) {
      setError("Selecciona una sede.");
      return;
    }

    setLoading(true);
    try {
      await signInGuarda({ username: username.trim(), password, sede, jornada });
    } catch (e: any) {
      setError(toUiErrorMessage(e, "No se pudo iniciar sesión."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModernScreen contentStyle={{ justifyContent: "center" }}>
      <FadeInCard style={{ gap: 18 }}>
        <Pill text="SEGURIDAD" />
        <TitleBlock
          title={config.nombre_institucion || "Control de seguridad"}
          subtitle="Ingresa tu documento, selecciona sede y abre tu turno operativo."
        />

        <InputField
          label="Documento"
          value={username}
          onChangeText={onUsernameChange}
          placeholder="1053444048"
          autoCapitalize="none"
          keyboardType="number-pad"
          maxLength={10}
        />

        <InputField
          label="Contraseña"
          value={password}
          onChangeText={onPasswordChange}
          placeholder="Ingresa tu contraseña"
          secureTextEntry
        />

        <View style={{ gap: 8 }}>
          <TitleBlock title="Sede" subtitle="Selecciona la sede donde vas a operar hoy." />
          <View style={{ borderWidth: 1, borderColor: "rgba(148,163,184,0.3)", borderRadius: 20, overflow: "hidden" }}>
            <Picker selectedValue={sede} onValueChange={(v) => setSede(v)}>
              {sedes.map((item) => (
                <Picker.Item key={item.id} label={item.name} value={item.code} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <TitleBlock title="Jornada" subtitle="Define el bloque de turno para el registro de accesos." />
          <View style={{ borderWidth: 1, borderColor: "rgba(148,163,184,0.3)", borderRadius: 20, overflow: "hidden" }}>
            <Picker selectedValue={jornada} onValueChange={(v) => setJornada(v)}>
              <Picker.Item label="Tarde" value="TARDE" />
              <Picker.Item label="Noche" value="NOCHE" />
            </Picker>
          </View>
        </View>

        {error ? <NoticeBanner tone="danger" text={error} /> : null}

        <ModernButton
          disabled={loading || !sede}
          onPress={onSubmit}
          label={loading ? "Abriendo turno..." : "Iniciar turno"}
          tone="primary"
          icon="shield-checkmark-outline"
        />
      </FadeInCard>
    </ModernScreen>
  );
}
