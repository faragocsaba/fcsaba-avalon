// Browser-only helpers: call from effects/handlers only.
// Tokens live per tab (sessionStorage) so two tabs in one browser are two separate players.
const key = (code: string) => `avalon-token-${code}`;
export const saveToken = (code: string, token: string) => sessionStorage.setItem(key(code), token);
export const loadToken = (code: string) => sessionStorage.getItem(key(code));
export const clearToken = (code: string) => sessionStorage.removeItem(key(code));
export const saveName = (n: string) => localStorage.setItem("avalon-name", n);
export const loadName = () => localStorage.getItem("avalon-name") ?? "";
