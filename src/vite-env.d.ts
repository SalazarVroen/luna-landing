/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where waitlist sign-ups are POSTed. Public by design; unset means preview mode (saved on the device). */
  readonly VITE_WAITLIST_ENDPOINT?: string;
}
