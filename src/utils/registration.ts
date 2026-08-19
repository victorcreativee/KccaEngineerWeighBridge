/** Produces a comparison key without changing the operator-facing registration. */
export function normalizeRegistration(value: string): string { return value.toUpperCase().replace(/[^A-Z0-9]/g, ""); }
