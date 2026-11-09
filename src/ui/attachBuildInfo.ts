import { BUILD_INFO_LABEL } from "../buildInfo.generated";

/** Pevný štítek sestavení — viditelný v menu i ve hře, mimo herní plátno. */
export function attachBuildInfoLabel(onRemove?: () => void): () => void {
  const existing = document.getElementById("tilt-maze-build-info");
  if (existing) {
    existing.remove();
  }
  const el = document.createElement("div");
  el.id = "tilt-maze-build-info";
  el.textContent = BUILD_INFO_LABEL;
  el.style.cssText = [
    "position:fixed",
    "right:10px",
    "bottom:8px",
    "z-index:2147483645",
    "font:10px/1.3 system-ui,sans-serif",
    "color:rgba(245,230,211,0.72)",
    "text-shadow:0 1px 2px #000",
    "pointer-events:none",
    "max-width:min(90vw,420px)",
    "text-align:right",
    "white-space:pre-wrap",
    "word-break:break-word"
  ].join(";");
  document.body.appendChild(el);
  const remove = (): void => {
    el.remove();
    onRemove?.();
  };
  return remove;
}
