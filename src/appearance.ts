const palettes = {
  yellow: { paper: "#fff8dc", accent: "#745500", soft: "#f6e8aa" },
  green: { paper: "#ecf7ed", accent: "#246039", soft: "#d8eedd" },
} as const;
export const themes = ["system", "light", "dark", "green", "yellow", "custom"] as const;
export const defaultCustomColor = "#16645d";
export type Theme = (typeof themes)[number];
export type Appearance = {
  textSize: number;
  density: "compact" | "comfortable";
  theme: Theme;
  customColor?: string;
};

function validColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function customPalette(color: string) {
  const components = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16));
  const tint = (base: number, amount: number) =>
    "#" + components.map(channel =>
      Math.round(base + amount * (channel - base)).toString(16).padStart(2, "0"),
    ).join("");
  return { paper: tint(255, 0.08), accent: tint(0, 0.43), soft: tint(255, 0.18) };
}

export function readAppearance(): Appearance {
  try {
    const value = JSON.parse(
      localStorage.getItem("core-aura.appearance") || "null",
    );
    return {
      textSize: Number.isFinite(value?.textSize)
        ? Math.max(90, Math.min(140, value.textSize))
        : 100,
      density: value?.density === "comfortable" ? "comfortable" : "compact",
      theme: themes.includes(value?.theme) ? value.theme : "system",
      ...(validColor(value?.customColor) ? { customColor: value.customColor } : {}),
    };
  } catch {
    return { textSize: 100, density: "compact", theme: "system" };
  }
}
export function applyAppearance(value: Appearance) {
  const root = document.documentElement;
  root.dataset.textSize = value.textSize >= 125 ? "large" : "normal";
  root.style.setProperty("--text-scale", String(value.textSize / 100));
  root.dataset.density = value.density;
  root.dataset.theme = value.theme;
  const resolved =
    value.theme === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : value.theme;
  root.dataset.resolvedTheme = resolved;
  const palette = resolved === "custom"
    ? customPalette(validColor(value.customColor) ? value.customColor : defaultCustomColor)
    : resolved === "green" || resolved === "yellow" ? palettes[resolved] : undefined;
  root.style.setProperty("--theme-paper", palette?.paper ?? "");
  root.style.setProperty("--theme-accent", palette?.accent ?? "");
  root.style.setProperty("--theme-accent-soft", palette?.soft ?? "");
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = palette?.paper ?? (resolved === "dark" ? "#10161d" : "#f4f6f8");
}
export function saveAppearance(value: Appearance) {
  applyAppearance(value);
  try {
    localStorage.setItem("core-aura.appearance", JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
