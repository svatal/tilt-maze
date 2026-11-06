/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly BASE_URL: string;
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
