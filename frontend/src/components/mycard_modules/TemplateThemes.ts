import { TemplateMeta, TemplateKey } from "./types";

export const TEMPLATES: Record<TemplateKey, TemplateMeta> = {
  tacticalCommander: {
    id: "tacticalCommander",
    name: "Tactical Commander",
    description: "Gunmetal command deck with HUD gridlines and neon brackets.",
    thumbnail: "/images/d2858ae2d2fbf2b68d5c5cf5f26b40de4cb624246a86642400e6d77e482c5146.png",
    background: "mycard-theme mycard-theme--tactical",
    accent: "text-cyan-400",
    border: "border-cyan-500/40",
    font: "font-mono tracking-wide uppercase",
    uniqueElement: "HUD gridlines + neon corner brackets",
    accentColor: "#22d3ee",
  },
  fieldOperations: {
    id: "fieldOperations",
    name: "Field Operations",
    description: "Field texture with radar sweep and amber tactical highlights.",
    thumbnail: "/images/7949ddf4863d8f9a141681c863116fad065c1f26f1aa10ca2cfcdc047d74e8f6.png",
    background: "mycard-theme mycard-theme--field",
    accent: "text-amber-400",
    border: "border-amber-500/40",
    font: "font-sans",
    uniqueElement: "Radar sweep animation overlay",
    accentColor: "#f59e0b",
  },
  eliteAgent: {
    id: "eliteAgent",
    name: "Elite Agent",
    description: "Carbon shell with gold trim and holographic sheen.",
    thumbnail: "/images/f523f74e097cdb5307708aafec7decef0e3912d46ad87f888848bd60ce74540b.png",
    background: "mycard-theme mycard-theme--elite",
    accent: "text-yellow-400",
    border: "border-yellow-500/40",
    font: "font-light tracking-tight",
    uniqueElement: "Gold trim + subtle holographic sheen",
    accentColor: "#facc15",
  },
};

export const LEGACY_TEMPLATE_ID_MAP: Record<string, TemplateKey> = {
  tactical_commander: "tacticalCommander",
  field_ops: "fieldOperations",
  elite_agent: "eliteAgent",
  tacticalCommander: "tacticalCommander",
  fieldOperations: "fieldOperations",
  eliteAgent: "eliteAgent",
};

export const TEMPLATE_FALLBACK_ID: TemplateKey = "tacticalCommander";

export const toTemplateKey = (value?: string): TemplateKey => {
  if (!value) return TEMPLATE_FALLBACK_ID;
  return LEGACY_TEMPLATE_ID_MAP[value] || TEMPLATE_FALLBACK_ID;
};

