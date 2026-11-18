export const themes = ["system", "light", "dark", "contrast"] as const;
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
  const colors = { light: "#f6f4f1", dark: "#15141c", contrast: "#000000" };
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (meta) meta.content = colors[resolved];
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
