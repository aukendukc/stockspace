export const STORAGE_KEYS = {
  authToken: "auth_token",
  guestMode: "guest_mode_enabled",
} as const;

export type StorageKey = keyof typeof STORAGE_KEYS;

export const getStorageKey = (key: StorageKey) => STORAGE_KEYS[key];







