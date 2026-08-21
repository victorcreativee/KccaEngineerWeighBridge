export type AuditEvent = { id: string; at: string; actor: string; role: string; action: string; details: string; reference?: string };
export const auditKey = "buyala.local.audit.v1";

export function readAudit(): AuditEvent[] { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem(auditKey) ?? "[]") as AuditEvent[]; } catch { return []; } }

export function logAudit(actor: string, role: string, action: string, details: string, reference?: string) {
  if (typeof window === "undefined") return;
  const event: AuditEvent = { id: crypto.randomUUID(), at: new Date().toISOString(), actor, role, action, details, reference };
  localStorage.setItem(auditKey, JSON.stringify([...readAudit(), event].slice(-1000)));
}
