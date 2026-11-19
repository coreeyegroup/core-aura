export const chakraThemes = {
  red: { label: "Red · Root", paper: "#fff3f2", accent: "#a12835", soft: "#fbe1e2" },
  orange: { label: "Orange · Sacral", paper: "#fff3e8", accent: "#984015", soft: "#ffe3ce" },
  yellow: { label: "Yellow · Solar plexus", paper: "#fff8dc", accent: "#745500", soft: "#f6e8aa" },
  green: { label: "Green · Heart", paper: "#ecf7ed", accent: "#246039", soft: "#d8eedd" },
  blue: { label: "Blue · Throat", paper: "#edf6ff", accent: "#235b91", soft: "#dbeafe" },
  indigo: { label: "Indigo · Third eye", paper: "#eeefff", accent: "#41499b", soft: "#e0e3fb" },
  purple: { label: "Purple · Crown", paper: "#f6effc", accent: "#65388a", soft: "#ebddf5" },
} as const;
type ChakraTheme = keyof typeof chakraThemes;
export const themes = [
  "system", "light", "dark", "contrast",
  ...Object.keys(chakraThemes) as ChakraTheme[],
] as const;
export type Theme = (typeof themes)[number];
export type Appearance = {
  textSize: number;
  density: "compact" | "comfortable";
  theme: Theme;
};
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
  const colors = { light: "#f4f6f8", dark: "#10161d", contrast: "#000000" };
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  const palette = chakraThemes[resolved as ChakraTheme];
  root.style.setProperty("--theme-paper", palette?.paper ?? "");
  root.style.setProperty("--theme-accent", palette?.accent ?? "");
  root.style.setProperty("--theme-accent-soft", palette?.soft ?? "");
  if (meta) meta.content = palette?.paper ?? colors[resolved as keyof typeof colors];
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
