import { doc, getDoc, onSnapshot, setDoc, type Unsubscribe } from "firebase/firestore";
import { firestore } from "./client";

const configKey = "buyala.local.operationalConfig.v1";
const configRef = () => doc(firestore, "systemState", "operationalConfig");

export type OperationalConfig = {
  id: "operationalConfig";
  facilityName: string;
  facilityCode: string;
  ticketPrefix: string;
  timezone: "Africa/Kampala";
  divisions: string[];
  vehicleTypes: string[];
  updatedAt?: string;
  updatedBy?: string;
};

export const defaultOperationalConfig: OperationalConfig = {
  id: "operationalConfig",
  facilityName: "Buyala Waste Management Facility",
  facilityCode: "BUYALA",
  ticketPrefix: "BUY",
  timezone: "Africa/Kampala",
  divisions: ["Central", "Nakawa", "Makindye", "Kawempe", "Lubaga"],
  vehicleTypes: ["Compactor", "Tipper truck", "Skip loader", "Tractor", "Pickup", "Other"],
};

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalize(value: Partial<OperationalConfig>): OperationalConfig {
  return {
    ...defaultOperationalConfig,
    ...value,
    id: "operationalConfig",
    ticketPrefix: (value.ticketPrefix || defaultOperationalConfig.ticketPrefix).trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6),
    divisions: unique(value.divisions?.length ? value.divisions : defaultOperationalConfig.divisions),
    vehicleTypes: unique(value.vehicleTypes?.length ? value.vehicleTypes : defaultOperationalConfig.vehicleTypes),
    timezone: "Africa/Kampala",
  };
}

function store(config: OperationalConfig) {
  const serialized = JSON.stringify(config);
  if (localStorage.getItem(configKey) === serialized) return;
  localStorage.setItem(configKey, serialized);
  window.dispatchEvent(new CustomEvent("buyala:operational-config", { detail: config }));
}

export function getOperationalConfig() {
  if (typeof window === "undefined") return defaultOperationalConfig;
  try { return normalize(JSON.parse(localStorage.getItem(configKey) ?? "{}") as Partial<OperationalConfig>); }
  catch { return defaultOperationalConfig; }
}

export async function hydrateOperationalConfig() {
  try {
    const snapshot = await getDoc(configRef());
    if (snapshot.exists()) store(normalize(snapshot.data() as Partial<OperationalConfig>));
  } catch { /* The last locally saved configuration remains available offline. */ }
}

export function subscribeOperationalConfig(): Unsubscribe {
  return onSnapshot(configRef(), (snapshot) => { if (snapshot.exists()) store(normalize(snapshot.data() as Partial<OperationalConfig>)); });
}

export async function saveOperationalConfig(config: OperationalConfig) {
  const normalized = normalize(config);
  store(normalized);
  await setDoc(configRef(), normalized);
  return normalized;
}
