/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** TEMPORARY — see pages/Login.tsx. Shows the "Continue as guest" button only when exactly 'true'. */
  readonly VITE_ENABLE_GUEST_LOGIN?: string;
}
