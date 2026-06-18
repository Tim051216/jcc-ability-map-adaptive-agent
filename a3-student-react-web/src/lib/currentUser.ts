import {
  PERSISTENT_SESSION_STORAGE_KEY,
  RECOVERY_SESSION_STORAGE_KEY,
  SESSION_STORAGE_KEY,
} from "../App";
import { getDemoUserProfile } from "./userProfiles";

type StoredUserSession = {
  id?: string;
  name?: string;
  loggedIn?: boolean;
};

export function getCurrentLoggedInUserId(fallback = 1001) {
  if (typeof window === "undefined") return fallback;
  const candidates = [
    window.sessionStorage.getItem(SESSION_STORAGE_KEY),
    window.localStorage.getItem(PERSISTENT_SESSION_STORAGE_KEY),
    window.localStorage.getItem(RECOVERY_SESSION_STORAGE_KEY),
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as StoredUserSession;
      if (parsed?.loggedIn && parsed?.id && /^\d+$/.test(String(parsed.id))) {
        return Number(parsed.id);
      }
    } catch {
      // Ignore malformed session data.
    }
  }

  return fallback;
}

export function getCurrentLoggedInUserIdString(fallback = "1001") {
  return String(getCurrentLoggedInUserId(Number(fallback)));
}

export function getCurrentLoggedInUserName(fallback = "同学") {
  if (typeof window === "undefined") return fallback;
  const candidates = [
    window.sessionStorage.getItem(SESSION_STORAGE_KEY),
    window.localStorage.getItem(PERSISTENT_SESSION_STORAGE_KEY),
    window.localStorage.getItem(RECOVERY_SESSION_STORAGE_KEY),
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as StoredUserSession;
      const profile = parsed?.id ? getDemoUserProfile(parsed.id) : null;
      if (parsed?.loggedIn && parsed?.name?.trim()) {
        return parsed.name.trim();
      }
      if (parsed?.loggedIn && profile?.name) {
        return profile.name;
      }
    } catch {
      // Ignore malformed session data.
    }
  }

  return fallback;
}
