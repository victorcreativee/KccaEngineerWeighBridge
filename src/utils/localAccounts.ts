export type LocalAccount = { username: string; password: string; name: string; role: "Data Clerk" | "Engineer"; initials: string; active: boolean; createdAt?: string; passwordChangedAt?: string; mustChangePassword?: boolean };
export const accountsKey = "buyala.local.accounts.v1";
export const defaultAccounts: LocalAccount[] = [
  { username: "clerk", password: "BuyalaClerk2026!", name: "Buyala Data Clerk", role: "Data Clerk", initials: "DC", active: true, mustChangePassword: false },
  { username: "engineer", password: "BuyalaEngineer2026!", name: "KCCA Engineer", role: "Engineer", initials: "KE", active: true, mustChangePassword: false },
];

export function readLocalAccounts(): LocalAccount[] { if (typeof window === "undefined") return defaultAccounts; try { const saved = JSON.parse(localStorage.getItem(accountsKey) ?? "null") as LocalAccount[] | null; return Array.isArray(saved) && saved.length ? saved : defaultAccounts; } catch { return defaultAccounts; } }
export function saveLocalAccounts(accounts: LocalAccount[]) { localStorage.setItem(accountsKey, JSON.stringify(accounts)); }
