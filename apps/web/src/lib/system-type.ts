export type SystemTypeOption = {
  value: string;
  label: string;
};

export const SYSTEM_TYPE_OPTIONS: SystemTypeOption[] = [
  { value: "solar", label: "Solar" },
  { value: "gas", label: "Gás" },
  { value: "eletrico", label: "Elétrico" },
  { value: "piscina", label: "Piscina" },
  { value: "sauna", label: "Sauna" },
  { value: "misto_tipo_1", label: "Misto Tipo 1 - Solar + Gás" },
  { value: "misto_tipo_2", label: "Misto Tipo 2 - Solar + Resistência" },
  { value: "misto_tipo_3", label: "Misto Tipo 3 - Solar + Gás + Elétrico" },
];

const LEGACY_LABEL_TO_VALUE: Record<string, string> = {
  "aquecimento solar": "solar",
  "bombas hidraulicas": "piscina",
  "caldeiras a gas": "gas",
  "sistema de incendio": "eletrico",
  "misto tipo 1": "misto_tipo_1",
  "misto tipo 2": "misto_tipo_2",
  "misto tipo 3": "misto_tipo_3",
};

function toAscii(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeSystemType(type: string | null | undefined) {
  const raw = String(type || "").trim();
  if (!raw) return "";

  const normalized = toAscii(raw).toLowerCase().replace(/\s+/g, " ").trim();
  if (LEGACY_LABEL_TO_VALUE[normalized]) {
    return LEGACY_LABEL_TO_VALUE[normalized];
  }

  return normalized.replace(/\s+/g, "_");
}

export function getSystemTypeLabel(type: string | null | undefined) {
  const normalized = normalizeSystemType(type);
  const found = SYSTEM_TYPE_OPTIONS.find((item) => item.value === normalized);
  if (found) return found.label;
  return String(type || "-");
}

export function getSystemTypeIcon(type: string | null | undefined) {
  const normalized = normalizeSystemType(type);
  if (normalized.includes("solar")) return "solar_power";
  if (normalized.includes("gas")) return "mode_fan";
  if (normalized.includes("piscina") || normalized.includes("bomba") || normalized.includes("hidro")) {
    return "water_drop";
  }
  if (normalized.includes("eletrico") || normalized.includes("incendio")) return "bolt";
  if (normalized.includes("sauna")) return "device_thermostat";
  return "settings_input_component";
}

