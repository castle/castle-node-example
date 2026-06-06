/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Castle publishable key (pk_...), used by the browser SDK. */
  readonly VITE_CASTLE_PK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
