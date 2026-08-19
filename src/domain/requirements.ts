export type RequirementStatus = "NEEDS_CONFIRMATION" | "CONFIRMED";
export interface OpenRequirement { id: string; question: string; status: RequirementStatus; affects: string[]; }
const questions: Array<[string, string, string[]]> = [
  ["tare-workflow", "Is tare stored per vehicle, or measured after dumping?", ["operations", "vehicles", "reports"]],
  ["vehicle-routes", "Can one vehicle operate on different collection routes?", ["operations", "vehicles"]],
  ["vehicle-divisions", "Can one vehicle operate under different divisions?", ["operations", "vehicles", "reports"]],
  ["nabugabo", "What exactly does Nabugabo represent?", ["reference-data", "reports"]],
  ["shifts", "Are there multiple daily shifts?", ["operations", "reports"]],
  ["data-entry-role", "Who enters weighbridge records?", ["authentication", "audit"]],
  ["review", "Are records reviewed or approved by another person?", ["workflow", "security"]],
  ["rejections", "Are trucks ever rejected?", ["operations", "reporting"]],
  ["waste-type", "Is waste type or category recorded?", ["operations", "reporting"]],
  ["fees", "Are payments or fees involved?", ["scope"]],
  ["receipts", "Are receipts generated?", ["scope", "exports"]],
  ["weekly-reports", "Does the engineer prepare weekly reports?", ["reports"]],
  ["monthly-reports", "What monthly reports are submitted?", ["reports"]],
  ["report-recipients", "Who receives reports?", ["reports", "security"]],
  ["weight-correction", "What happens when an incorrect weight is entered?", ["operations", "audit"]],
  ["unknown-vehicle-policy", "What happens when a vehicle is not registered?", ["operations", "security"]],
  ["unknown-driver-policy", "What happens when a driver is not registered?", ["operations", "security"]],
  ["connectivity", "Is internet reliable at the weighbridge?", ["offline", "sync"]],
  ["pilot-users", "How many people will use the first pilot?", ["authentication", "security"]],
  ["operator-devices", "What devices will operators use?", ["responsive-design", "testing"]],
];
export const openRequirements: OpenRequirement[] = questions.map(([id, question, affects]) => ({ id, question, affects, status: "NEEDS_CONFIRMATION" }));
