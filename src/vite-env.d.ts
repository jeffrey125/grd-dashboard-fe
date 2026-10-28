/// <reference types="google.maps" />

interface ViteTypeOptions {
  strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  readonly VITE_API_ORIGIN?: string;
  readonly VITE_GOOGLE_PLACES_API_KEY?: string;
}

declare const __GRD_RELEASE__: string;
