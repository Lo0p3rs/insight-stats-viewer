const TOKEN_KEY = 'insight_token';
const EVENT_KEY = 'insight_event_key';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
}

export function getSelectedEventKey(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(EVENT_KEY);
}

export function setSelectedEventKey(key: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(EVENT_KEY, key);
}
