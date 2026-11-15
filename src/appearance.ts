export type Appearance = {
  textSize: number;
  density: "compact" | "comfortable";
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
    };
  } catch {
    return { textSize: 100, density: "compact" };
  }
}
export function saveAppearance(value: Appearance) {
  document.documentElement.dataset.textSize =
    value.textSize >= 125 ? "large" : "normal";
  document.documentElement.style.setProperty(
    "--text-scale",
    String(value.textSize / 100),
  );
  document.documentElement.dataset.density = value.density;
  try {
    localStorage.setItem("core-aura.appearance", JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
