export type UserRole = "OPERATOR" | "MANAGER";
export interface AuthenticatedUser { id: string; email: string; displayName?: string; role: UserRole; facilityId: string; }
export interface AuthService { getCurrentUser(): Promise<AuthenticatedUser | null>; signIn(email: string, password: string): Promise<AuthenticatedUser>; signOut(): Promise<void>; subscribe(listener: (user: AuthenticatedUser | null) => void): () => void; }
