import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { api } from "../../src/api/client";
import GuardBottomDock from "../../src/components/guard/GuardBottomDock";
import { guardHomeThemes, GuardThemeMode } from "../../src/components/guard/GuardHomeSections";
import { useResolvedThemeMode } from "../../src/store/preferences";
import { ModernButton, ModernScreen } from "../../src/ui/modern";

type Movimiento = {
  id: number;
  tipo: "ingreso" | "salida";
  fecha: string;
  sede?: string;
  estado?: string;
  aprendiz_nombre?: string;
  aprendiz?: {
    first_name?: string;
    last_name?: string;
    documento?: string;
  };
  documento?: string;
};

type TipoFiltro = "todos" | "ingreso" | "salida";

export default function GuardHistorial() {
  const mode = useResolvedThemeMode() as GuardThemeMode;
  const theme = guardHomeThemes[mode];

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Movimiento[]>([]);

  const [searchDraft, setSearchDraft] = useState("");
  const [dateDraft, setDateDraft] = useState("");
  const [selectedTipoDraft, setSelectedTipoDraft] = useState<TipoFiltro>("todos");

  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTipo, setSelectedTipo] = useState<TipoFiltro>("todos");

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/accesos/?page=1${search.trim() ? `&q=${encodeURIComponent(search.trim())}` : ""}`;
      const response = await api.get(url);
      setRows((response.data?.results ?? []) as Movimiento[]);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  function applyFilters() {
    setSearch(searchDraft.trim());
    setSelectedDate(dateDraft.trim());
    setSelectedTipo(selectedTipoDraft);
  }

  function clearFilters() {
    setSearchDraft("");
    setDateDraft("");
    setSelectedTipoDraft("todos");
    setSearch("");
    setSelectedDate("");
    setSelectedTipo("todos");
  }

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const rowDate = formatDate(row.fecha);
      const rowTipo = row.tipo?.toLowerCase();

      const matchesDate = selectedDate ? rowDate === selectedDate : true;
      const matchesTipo = selectedTipo !== "todos" ? rowTipo === selectedTipo : true;

      return matchesDate && matchesTipo;
    });
  }, [rows, selectedDate, selectedTipo]);

  const summary = useMemo(() => {
    const today = formatDate(new Date().toISOString());
    const ingresosHoy = filteredRows.filter((row) => row.tipo === "ingreso" && formatDate(row.fecha) === today).length;
    const salidasHoy = filteredRows.filter((row) => row.tipo === "salida" && formatDate(row.fecha) === today).length;
    return {
      ingresosHoy,
      salidasHoy,
      total: filteredRows.length,
    };
  }, [filteredRows]);

  return (
    <View style={styles.root}>
      <ModernScreen scroll theme="guard" contentStyle={{ paddingBottom: 154 }}>
        <View style={styles.headerBlock}>
          <Text style={[styles.screenTitle, { color: theme.text }]}>Reportes</Text>
          <Text style={[styles.screenSubtitle, { color: theme.textSoft }]}>
            Consulta movimientos, aplica filtros y revisa la actividad operativa del turno.
          </Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: theme.sectionBg, borderColor: theme.summaryBorder }]}>
          <SummaryMetric label="Ingresos hoy" value={summary.ingresosHoy} icon="log-in-outline" theme={theme} />
          <SummaryMetric label="Salidas hoy" value={summary.salidasHoy} icon="log-out-outline" theme={theme} />
          <SummaryMetric label="Total registros" value={summary.total} icon="layers-outline" theme={theme} highlight />
        </View>

        <View style={[styles.filterCard, { backgroundColor: theme.sectionBg, borderColor: theme.summaryBorder }]}>
          <Text style={[styles.filterTitle, { color: theme.text }]}>Filtros</Text>

          <View style={styles.filterStack}>
            <FilterInput
              value={searchDraft}
              onChangeText={setSearchDraft}
              placeholder="Buscar por identificación o nombre"
              icon="search-outline"
              theme={theme}
            />

            <FilterInput
              value={dateDraft}
              onChangeText={setDateDraft}
              placeholder="Fecha (YYYY-MM-DD)"
              icon="calendar-outline"
              theme={theme}
            />

            <View style={styles.chipSection}>
              <Text style={[styles.chipLabel, { color: theme.textSoft }]}>Tipo de movimiento</Text>
              <View style={styles.chipWrap}>
                <FilterChip label="Todos" active={selectedTipoDraft === "todos"} onPress={() => setSelectedTipoDraft("todos")} theme={theme} />
                <FilterChip label="Ingresos" active={selectedTipoDraft === "ingreso"} onPress={() => setSelectedTipoDraft("ingreso")} theme={theme} />
                <FilterChip label="Salidas" active={selectedTipoDraft === "salida"} onPress={() => setSelectedTipoDraft("salida")} theme={theme} />
              </View>
            </View>

            <View style={styles.actionsRow}>
              <View style={styles.actionButton}>
                <ModernButton
                  icon="filter-outline"
                  label={loading ? "Aplicando..." : "Aplicar filtro"}
                  tone="guard"
                  onPress={applyFilters}
                  disabled={loading}
                />
              </View>
              <View style={styles.actionButton}>
                <ModernButton icon="refresh-outline" label="Limpiar" tone="light" onPress={clearFilters} disabled={loading} />
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.listCard, { backgroundColor: theme.sectionBg, borderColor: theme.summaryBorder }]}>
          <View style={styles.listHeader}>
            <Text style={[styles.listTitle, { color: theme.text }]}>Movimientos</Text>
            <Text style={[styles.listCount, { color: theme.textSoft }]}>{filteredRows.length} registros</Text>
          </View>

          {loading ? (
            <ActivityIndicator color={theme.accentStrong} size="large" style={{ marginVertical: 48 }} />
          ) : (
            <FlatList
              data={filteredRows}
              scrollEnabled={false}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={filteredRows.length === 0 ? { paddingVertical: 18 } : { gap: 10 }}
              renderItem={({ item }) => <RegistroRow item={item} theme={theme} />}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="document-text-outline" size={44} color={theme.textSoft} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>No hay registros para mostrar</Text>
                  <Text style={[styles.emptyBody, { color: theme.textSoft }]}>Ajusta los filtros o realiza una búsqueda para consultar movimientos.</Text>
                </View>
              }
            />
          )}
        </View>
      </ModernScreen>

      <GuardBottomDock active="reportes" mode={mode} />
    </View>
  );
}

function SummaryMetric({
  label,
  value,
  icon,
  theme,
  highlight = false,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  theme: typeof guardHomeThemes.light;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.metricBox, { backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.46)", borderColor: theme.divider }]}>
      <Ionicons name={icon} size={18} color={highlight ? theme.accentStrong : theme.accent} />
      <Text style={[styles.metricValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: theme.textSoft }]}>{label}</Text>
    </View>
  );
}

function FilterInput({
  value,
  onChangeText,
  placeholder,
  icon,
  theme,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme: typeof guardHomeThemes.light;
}) {
  return (
    <View style={[styles.inputWrap, { backgroundColor: theme.mode === "dark" ? "rgba(14,24,40,0.84)" : "rgba(255,255,255,0.92)", borderColor: theme.divider }]}>
      <Ionicons name={icon} size={18} color={theme.accent} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSoft}
        style={[styles.input, { color: theme.text }]}
      />
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  theme,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: typeof guardHomeThemes.light;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          backgroundColor: active ? theme.accentStrong : theme.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.58)",
          borderColor: active ? theme.accentStrong : theme.divider,
        },
      ]}
    >
      <Text style={[styles.filterChipText, { color: active ? "#ffffff" : theme.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

function RegistroRow({
  item,
  theme,
}: {
  item: Movimiento;
  theme: typeof guardHomeThemes.light;
}) {
  const ingreso = item.tipo === "ingreso";
  const nombre =
    item.aprendiz_nombre ||
    [item.aprendiz?.first_name, item.aprendiz?.last_name].filter(Boolean).join(" ") ||
    "Movimiento registrado";
  const identificacion = item.documento || item.aprendiz?.documento || `#${item.id}`;
  return (
    <View
      style={[
        styles.rowCard,
        {
          backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.58)",
          borderColor: theme.divider,
        },
      ]}
    >
      <View style={[styles.rowIconShell, { backgroundColor: ingreso ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)" }]}>
        <Ionicons name={ingreso ? "log-in-outline" : "log-out-outline"} size={18} color={ingreso ? "#10b981" : "#f59e0b"} />
      </View>

      <View style={styles.rowTextWrap}>
        <Text style={[styles.rowPrimary, { color: theme.text }]}>{nombre}</Text>
        <Text style={[styles.rowSecondary, { color: theme.textSoft }]}>Identificación {identificacion}</Text>
        <Text style={[styles.rowMeta, { color: theme.textMuted }]}>
          {capitalize(item.tipo)} {"•"} {formatDate(item.fecha)} {"•"} {formatHour(item.fecha)}
        </Text>
      </View>

      <View style={styles.rowAside}>
        <Text style={[styles.rowBadge, { color: ingreso ? "#0f8b61" : "#b45309" }]}>{capitalize(item.tipo)}</Text>
        <Text style={[styles.rowAsideText, { color: theme.textSoft }]}>{item.sede || "-"}</Text>
        <Text style={[styles.rowAsideText, { color: theme.textSoft }]}>{item.estado || "Registrado"}</Text>
      </View>
    </View>
  );
}

function formatDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatHour(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBlock: {
    gap: 6,
  },
  screenTitle: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  screenSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  summaryCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    gap: 10,
  },
  metricBox: {
    flex: 1,
    minHeight: 96,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "900",
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  filterCard: {
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 24,
    gap: 18,
  },
  filterTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  filterStack: {
    gap: 18,
  },
  inputWrap: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  chipSection: {
    gap: 12,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 11,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
  },
  listCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    marginBottom: 24,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  listCount: {
    fontSize: 13,
    fontWeight: "700",
  },
  rowCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
  },
  rowIconShell: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTextWrap: {
    flex: 1,
    gap: 2,
  },
  rowPrimary: {
    fontSize: 15,
    fontWeight: "800",
  },
  rowSecondary: {
    fontSize: 12,
    fontWeight: "600",
  },
  rowMeta: {
    fontSize: 12,
    fontWeight: "600",
  },
  rowAside: {
    alignItems: "flex-end",
    gap: 3,
  },
  rowBadge: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  rowAsideText: {
    fontSize: 11,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 34,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    textAlign: "center",
  },
});
