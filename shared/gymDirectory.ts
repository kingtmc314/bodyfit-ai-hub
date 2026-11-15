/** Address discovery is not equipment discovery. Inventory is owner/branch-specific. */
export const GYM_EQUIPMENT_TYPES = [
  "Machine",
  "Cable",
  "Barbell",
  "Dumbbell",
  "Bodyweight",
  "Kettlebell",
  "Band",
  "Cardio",
  "Other",
] as const;
export type GymEquipmentType = (typeof GYM_EQUIPMENT_TYPES)[number];
export type GymEquipmentSource = "owner_confirmed" | "photo_confirmed";
export interface GymOfficialMachine {
  /** Stable snapshot item ID; never a DB row ID. */
  id: string;
  name: string;
  nameZh?: string;
  manufacturer: string | null;
  model: string | null;
  category: string | null;
  total: number | null;
  normal: number | null;
  damaged: number | null;
  sourceUrl: string;
}
export interface GymOfficialInventorySnapshot {
  /** Matches GymOfficialSeed.id (without official: prefix). */
  gymReferenceId: string;
  branchName: string;
  country: string;
  sourceUrl: string;
  checkedAt: string;
  status: "verified" | "unknown";
  machines: GymOfficialMachine[];
}
export type GymLocationSource =
  | "official_seed"
  | "google_places"
  | "owner_saved";
/** Numeric IDs are saved rows; official:/google: IDs are read-only, ephemeral references. */
export type GymId = number | string;
export interface GymOfficialSeed {
  id: string;
  name: string;
  address: string;
  country?: string;
  brand?: string;
  sourceUrl: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
  sourceCheckedAt?: string;
  aliases?: string[];
}
export interface GymLocation {
  id: GymId;
  savedId: number | null;
  name: string;
  address: string;
  country: string | null;
  brand: string | null;
  source: GymLocationSource;
  sourceUrl: string | null;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
  sourceCheckedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
export interface GymSearchInput {
  query: string;
  country?: string;
  limit?: number;
  offset?: number;
  pageToken?: string;
}
export interface GymSearchResult {
  results: GymLocation[];
  /** Total in this combined address result set, NOT worldwide completeness. */
  total: number;
  source: "官方及已保存地址搜尋" | "官方、已保存及全球地點供應商搜尋";
  providerStatus: string;
  providerWarning?: string;
  /** Provider only returns its current page; global pagination is not claimed. */
  providerHasMore: boolean;
  nextPageToken?: string;
  attribution: "Google Maps" | null;
  completeWorldwide: false;
}
export interface GymEquipmentRecord {
  id: number;
  gymId: number;
  machineKey: string;
  displayName: string;
  equipment: GymEquipmentType;
  source: GymEquipmentSource;
  notes: string | null;
  sourceUrl: string | null;
  confirmedAt: string;
  createdAt: string;
  updatedAt: string;
}
export interface GymFeasibleExercise {
  machineKey: string;
  equipmentId: number | string;
  guideId: string | null;
  name: string;
  nameZh: string;
  equipment: GymEquipmentType;
  /** Exact aliases for this machine/action only; never related-machine substitutions. */
  aliases: string[];
  primary: string[];
  secondary: string[];
  primaryLabels: string[];
  secondaryLabels: string[];
  referenceUrls: string[];
  confirmationSource: GymEquipmentSource | "official_inventory";
  availabilityCaution?: string;
}
export interface GymEquipmentResult {
  gym: GymLocation;
  equipment: GymEquipmentRecord[];
  /** Read-only published snapshot, distinct from owner confirmation records. */
  officialEquipment: GymOfficialMachine[];
  officialInventory: {
    sourceUrl: string;
    checkedAt: string;
    status: "verified";
    gymReferenceId: string;
  } | null;
  availableExercises: GymFeasibleExercise[];
  coverage: {
    status: "unknown" | "partially_confirmed" | "official_snapshot";
    confirmedEquipmentCount: number;
    officialEquipmentCount: number;
    mappedEquipmentCount: number;
    unmappedMachineKeys: string[];
    completeInventory: false;
    message: string;
  };
}
export interface GymSaveLocationInput {
  name: string;
  address: string;
  country?: string;
  brand?: string;
  sourceUrl?: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
}
export interface GymUpsertEquipmentInput {
  /** Save an official/provider address first, then use its numeric savedId. */
  gymId: number;
  machineKey: string;
  displayName: string;
  equipment: GymEquipmentType;
  source: GymEquipmentSource;
  notes?: string;
  sourceUrl?: string;
}
/** gym.getSaved() => GymLocation[]; gym.saveLocation(input) => GymLocation.
 * gym.getEquipment({gymId}) => GymEquipmentResult.
 * gym.upsertEquipment(input) => GymEquipmentRecord.
 * gym.deleteEquipment({id: number}) => {success: true}.
 * gym.getMachineCatalog() => exact machine options; unknown safe keys can be stored
 * but produce no exercise suggestions. All six owner APIs use fixed owner ID 2.
 * Timestamp strings are ISO UTC; UI should display Asia/Hong_Kong.
 */
