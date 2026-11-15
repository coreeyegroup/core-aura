// Let the browser fit its device viewport and retain pinch-to-zoom.
// Text size and spacing are independent saved preferences, never forced widths.
const viewport = document.querySelector('meta[name="viewport"]');
if (viewport)
  viewport.content = "width=device-width, initial-scale=1, viewport-fit=cover";
try {
  const value = JSON.parse(
    localStorage.getItem("core-aura.appearance") || "null",
  );
  const size = Number.isFinite(value?.textSize)
    ? Math.max(90, Math.min(140, value.textSize))
    : 100;
  document.documentElement.style.setProperty(
    "--text-scale",
    String(size / 100),
  );
  document.documentElement.dataset.density =
    value?.density === "comfortable" ? "comfortable" : "compact";
} catch {
  document.documentElement.dataset.density = "compact";
}
