/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly VITE_BASE_PATH: string;
  readonly VITE_IS_PR_PREVIEW: string;
  readonly VITE_DISABLE_PWA: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "virtual:pwa-register" {
  export type RegisterSWOptions = {
    immediate?: boolean;
  };
  export function registerSW(options?: RegisterSWOptions): void;
}
