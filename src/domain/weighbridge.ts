export type TransactionStatus = "OPEN" | "COMPLETED" | "VOIDED";
export type TareCaptureMode = "STORED_VEHICLE_TARE" | "SECOND_WEIGHING" | "UNCONFIRMED";
export interface AuditFields { createdBy: string; createdAt: string; updatedBy?: string; updatedAt?: string; }
export interface VehicleSnapshot { vehicleId?: string; registration: string; normalizedRegistration: string; vehicleMatched: boolean; vehicleType?: string; division?: string; concessionaire?: boolean; company?: string; }
export interface DriverSnapshot { driverId?: string; driverName?: string; driverPhone?: string; driverMatched: boolean; }
export interface WeighbridgeEntry extends AuditFields { id: string; facilityId: string; ticketNumber?: string; operationDate: string; shift?: string; vehicle: VehicleSnapshot; driver: DriverSnapshot; routeSource?: string; arrivalAt: string; grossKg?: number; tareKg?: number; tareCaptureMode: TareCaptureMode; netKg?: number; departureAt?: string; status: TransactionStatus; voidReason?: string; }
export interface Vehicle { id: string; facilityId: string; registration: string; normalizedRegistration: string; vehicleType?: string; concessionaire?: boolean; company?: string; defaultDivision?: string; defaultRoute?: string; defaultTareKg?: number; active: boolean; }
export interface Driver { id: string; facilityId: string; fullName: string; telephone?: string; companyOrNotes?: string; active: boolean; }
