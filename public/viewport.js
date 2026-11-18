// Apply saved presentation before app boot without changing the device viewport.
(() => {
  let value = {};
  try {
    value =
      JSON.parse(localStorage.getItem("core-aura.appearance") || "null") || {};
  } catch {}
  const root = document.documentElement,
    size = Number.isFinite(value.textSize)
      ? Math.max(90, Math.min(140, value.textSize))
      : 100;
  root.dataset.textSize = size >= 125 ? "large" : "normal";
  root.style.setProperty("--text-scale", String(size / 100));
  root.dataset.density =
    value.density === "comfortable" ? "comfortable" : "compact";
  root.dataset.theme = ["system", "light", "dark", "contrast"].includes(
    value.theme,
  )
    ? value.theme
    : "system";
  const theme =
    root.dataset.theme === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : root.dataset.theme;
  root.dataset.resolvedTheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta)
    meta.content = { light: "#f3f7f4", dark: "#111b19", contrast: "#000000" }[
      theme
    ];
})();
