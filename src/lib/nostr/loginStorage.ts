const AUTO_LOGIN_STORAGE_KEY = "autoLogin";
const NIP49_STORAGE_KEY = "nip49EncryptedSecret";

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch (_error) {
    return null;
  }
}

export function readAutoLoginPreference(): boolean {
  return getStorage()?.getItem(AUTO_LOGIN_STORAGE_KEY) === "true";
}

export function writeAutoLoginPreference(value: boolean): void {
  getStorage()?.setItem(AUTO_LOGIN_STORAGE_KEY, `${value}`);
}

export function getStoredNip49Secret(): string | null {
  return getStorage()?.getItem(NIP49_STORAGE_KEY) ?? null;
}

export function hasStoredNip49Secret(): boolean {
  return !!getStoredNip49Secret();
}

export function setStoredNip49Secret(ncryptsec: string): void {
  getStorage()?.setItem(NIP49_STORAGE_KEY, ncryptsec);
}

export function clearStoredNip49Secret(): void {
  getStorage()?.removeItem(NIP49_STORAGE_KEY);
}
