const TOKEN_KEY = 'crm_token';

// Hàm setToken: xử lý setToken
export function setToken(token: string) {
  document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=86400; samesite=lax`;
}

// Hàm clearToken: xử lý clearToken
export function clearToken() {
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`;
}

// Hàm getTokenClient: xử lý getTokenClient
export function getTokenClient(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)crm_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}
