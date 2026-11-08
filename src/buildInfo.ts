/** Hodnota z vite.config (define) při dev/build; mimo Vite jen pro typovou kontrolu. */
export const BUILD_INFO_LABEL =
  import.meta.env.VITE_BUILD_INFO_LABEL || "unknown · unknown · unknown";
