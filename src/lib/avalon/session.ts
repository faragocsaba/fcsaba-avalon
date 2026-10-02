// Browser-only helpers: call from effects/handlers only.
const key = (code: string) => `avalon-token-${code}`;
export const saveToken = (code: string, token: string) => localStorage.setItem(key(code), token);
export const loadToken = (code: string) => localStorage.getItem(key(code));
export const clearToken = (code: string) => localStorage.removeItem(key(code));
export const saveName = (n: string) => localStorage.setItem("avalon-name", n);
export const loadName = () => localStorage.getItem("avalon-name") ?? "";
