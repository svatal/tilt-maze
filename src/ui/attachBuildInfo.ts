import { BUILD_INFO_LABEL } from "../buildInfo.generated";
import styles from "./attachBuildInfo.module.css";

/** Pevný štítek sestavení — viditelný v menu i ve hře, mimo herní plátno. */
export function attachBuildInfoLabel(onRemove?: () => void): () => void {
  const existing = document.getElementById("tilt-maze-build-info");
  if (existing) {
    existing.remove();
  }
  const el = document.createElement("div");
  el.id = "tilt-maze-build-info";
  el.className = styles.buildInfo;
  el.textContent = BUILD_INFO_LABEL;
  document.body.appendChild(el);
  const remove = (): void => {
    el.remove();
    onRemove?.();
  };
  return remove;
}