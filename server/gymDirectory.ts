import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq, or, sql, asc } from "drizzle-orm";
import {
  gymLocations,
  gymEquipment,
  type SavedGymLocation,
  type SavedGymEquipment,
} from "../drizzle/schema";
import {
  GYM_EQUIPMENT_TYPES,
  type GymOfficialSeed,
  type GymOfficialInventorySnapshot,
  type GymOfficialMachine,
  type GymLocation,
  type GymSearchResult,
  type GymEquipmentRecord,
  type GymEquipmentResult,
  type GymFeasibleExercise,
  type GymEquipmentType,
} from "../shared/gymDirectory";
import { EXERCISE_GUIDES, getExerciseGuide } from "../shared/exerciseGuides";
import { GYMWORK_REFERENCES } from "../shared/gymworkReferences";
import { getExerciseMuscles } from "../shared/exerciseMuscles";
import { GYM_OFFICIAL_SEEDS } from "../shared/gymOfficialSeeds";
import { GYM_OFFICIAL_INVENTORY } from "../shared/gymOfficialInventory";
import { getDb } from "./db";
import { makeRequest } from "./_core/map";

export const GYM_OWNER_USER_ID = 2;
export const GYM_PROVIDER_DEADLINE_MS = 4500;
const READ_PAGE_SIZE = 50;
const cleanText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(s => !/[\u0000-\u001f\u007f]/.test(s), "文字不可包含控制字元");
export function isSafeGymSourceUrl(value: string): boolean {
  try {
    if (/[\u0000-\u0020\u007f\\]/.test(value)) return false;
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === "443") &&
      !isIP(host.replace(/^\[|\]$/g, "")) &&
      host.includes(".") &&
      !/(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(
        host
      ) &&
      !/(^|\.)(localhost|metadata\.google\.internal|nip\.io|sslip\.io)$/.test(
        host
      ) &&
      !Array.from(url.searchParams.keys()).some(k =>
        /^(key|api[_-]?key|token|access[_-]?token|authorization|signature)$/i.test(
          k
        )
      )
    );
  } catch {
    return false;
  }
}
const sourceUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(isSafeGymSourceUrl, "來源必須為不含密鑰的公開 HTTPS 網址");
export const gymNumericIdSchema = z.number().int().positive().max(2147483647);
export const gymIdSchema = z.union([
  gymNumericIdSchema,
  z
    .string()
    .max(400)
    .regex(/^(official|google):[a-zA-Z0-9_-]+(?::[a-zA-Z0-9_-]+)*$/),
  z
    .string()
    .max(400)
    .regex(/^247fitness:[a-zA-Z0-9_-]+(?::[a-zA-Z0-9_-]+)*$/),
]);
const providerKey = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const gymSearchSchema = z
  .object({
    query: z
      .string()
      .trim()
      .max(200)
      .refine(s => !/[\u0000-\u001f\u007f]/.test(s)),
    country: cleanText(100).optional(),
    limit: z.number().int().min(1).max(50).default(20),
    offset: z.number().int().min(0).max(1000000).default(0),
    pageToken: z
      .string()
      .min(1)
      .max(2048)
      .regex(/^[a-zA-Z0-9_=-]+$/)
      .optional(),
  })
  .strict();
export const gymSaveLocationSchema = z
  .object({
    name: cleanText(255),
    address: cleanText(2000),
    country: cleanText(100).optional(),
    brand: cleanText(100).optional(),
    sourceUrl: sourceUrl.optional(),
    placeId: providerKey.optional(),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
  })
  .strict()
  .refine(
    v => (v.latitude === undefined) === (v.longitude === undefined),
    "經緯度必須同時提供，未知請省略"
  );
export const gymUpsertEquipmentSchema = z
  .object({
    gymId: gymNumericIdSchema,
    machineKey: z
      .string()
      .trim()
      .min(1)
      .max(150)
      .regex(/^[a-z0-9]+(?:[-_:][a-z0-9]+)*$/),
    displayName: cleanText(255),
    equipment: z.enum(GYM_EQUIPMENT_TYPES),
    source: z.enum(["owner_confirmed", "photo_confirmed"]),
    notes: cleanText(4000).optional(),
    sourceUrl: sourceUrl.optional(),
  })
  .strict();
export type GymSearchParsed = z.infer<typeof gymSearchSchema>;
export type GymSaveParsed = z.infer<typeof gymSaveLocationSchema>;
export type GymUpsertParsed = z.infer<typeof gymUpsertEquipmentSchema>;

export function normalizeGymIdentity(value: string) {
  return value.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
}
export function gymIdentityKey(name: string, address: string) {
  return createHash("sha256")
    .update(`${normalizeGymIdentity(name)}\n${normalizeGymIdentity(address)}`)
    .digest("hex");
}
export function escapeGymLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}
const iso = (value: Date | string | null): string | null =>
  value == null ? null : new Date(value).toISOString();
const locationFields = {
  id: gymLocations.id,
  userId: gymLocations.userId,
  name: gymLocations.name,
  address: gymLocations.address,
  country: gymLocations.country,
  brand: gymLocations.brand,
  source: gymLocations.source,
  sourceUrl: gymLocations.sourceUrl,
  placeId: gymLocations.placeId,
  identityKey: gymLocations.identityKey,
  latitude: gymLocations.latitude,
  longitude: gymLocations.longitude,
  sourceCheckedAt: gymLocations.sourceCheckedAt,
  createdAt: gymLocations.createdAt,
  updatedAt: gymLocations.updatedAt,
};
const equipmentFields = {
  id: gymEquipment.id,
  userId: gymEquipment.userId,
  gymId: gymEquipment.gymId,
  machineKey: gymEquipment.machineKey,
  displayName: gymEquipment.displayName,
  equipment: gymEquipment.equipment,
  source: gymEquipment.source,
  notes: gymEquipment.notes,
  sourceUrl: gymEquipment.sourceUrl,
  confirmedAt: gymEquipment.confirmedAt,
  createdAt: gymEquipment.createdAt,
  updatedAt: gymEquipment.updatedAt,
};
function publicLocation(row: SavedGymLocation): GymLocation {
  return {
    id: row.id,
    savedId: row.id,
    name: row.name,
    address: row.address,
    country: row.country,
    brand: row.brand,
    source: row.source as GymLocation["source"],
    sourceUrl: row.sourceUrl,
    placeId: row.placeId,
    latitude: row.latitude,
    longitude: row.longitude,
    sourceCheckedAt: iso(row.sourceCheckedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}
function publicEquipment(row: SavedGymEquipment): GymEquipmentRecord {
  return {
    id: row.id,
    gymId: row.gymId,
    machineKey: row.machineKey,
    displayName: row.displayName,
    equipment: row.equipment as GymEquipmentType,
    source: row.source as GymEquipmentRecord["source"],
    notes: row.notes,
    sourceUrl: row.sourceUrl,
    confirmedAt: iso(row.confirmedAt)!,
    createdAt: iso(row.createdAt)!,
    updatedAt: iso(row.updatedAt)!,
  };
}
function seedLocation(seed: GymOfficialSeed): GymLocation | null {
  const parsed = gymSaveLocationSchema.safeParse({
    name: seed.name,
    address: seed.address,
    country: seed.country,
    brand: seed.brand,
    sourceUrl: seed.sourceUrl,
    placeId: seed.placeId,
    latitude: seed.latitude,
    longitude: seed.longitude,
  });
  if (
    !parsed.success ||
    seed.id.length > 380 ||
    !/^[a-zA-Z0-9_-]+(?::[a-zA-Z0-9_-]+)*$/.test(seed.id)
  )
    return null;
  const checked =
    seed.sourceCheckedAt && !Number.isNaN(Date.parse(seed.sourceCheckedAt))
      ? new Date(seed.sourceCheckedAt).toISOString()
      : null;
  return {
    id: `official:${seed.id}`,
    savedId: null,
    name: seed.name,
    address: seed.address,
    country: seed.country ?? null,
    brand: seed.brand ?? null,
    source: "official_seed",
    sourceUrl: seed.sourceUrl,
    placeId: seed.placeId ?? null,
    latitude: seed.latitude ?? null,
    longitude: seed.longitude ?? null,
    sourceCheckedAt: checked,
    createdAt: null,
    updatedAt: null,
  };
}
export function officialGymLocations(): GymLocation[] {
  return (GYM_OFFICIAL_SEEDS as readonly GymOfficialSeed[])
    .map(seedLocation)
    .filter((g): g is GymLocation => !!g);
}
function officialAliasMatch(g: GymLocation, query: string) {
  const seed = (GYM_OFFICIAL_SEEDS as readonly GymOfficialSeed[]).find(
    s => `official:${s.id}` === g.id
  );
  return (seed?.aliases ?? []).some(a =>
    normalizeGymIdentity(a).includes(normalizeGymIdentity(query))
  );
}
const textMatch = (g: GymLocation, query: string, country?: string) =>
  (!country ||
    normalizeGymIdentity(g.country ?? "") === normalizeGymIdentity(country)) &&
  (normalizeGymIdentity([g.name, g.address, g.brand].join(" ")).includes(
    normalizeGymIdentity(query)
  ) ||
    officialAliasMatch(g, query));
const priority = (g: GymLocation) =>
  /24\s*\/?\s*7\s*fitness/i.test(`${g.brand ?? ""} ${g.name}`) ? 0 : 1;
export function mergeGymLocations(groups: GymLocation[][]): GymLocation[] {
  const rows: GymLocation[] = [];
  const identities = new Set<string>();
  const places = new Set<string>();
  for (const group of groups)
    for (const row of group) {
      const identity = gymIdentityKey(row.name, row.address);
      if (identities.has(identity) || (row.placeId && places.has(row.placeId)))
        continue;
      identities.add(identity);
      if (row.placeId) places.add(row.placeId);
      rows.push(row);
    }
  return rows.sort(
    (a, b) =>
      priority(a) - priority(b) ||
      { owner_saved: 0, official_seed: 1, google_places: 2 }[a.source] -
        { owner_saved: 0, official_seed: 1, google_places: 2 }[b.source] ||
      normalizeGymIdentity(a.name).localeCompare(
        normalizeGymIdentity(b.name),
        "en"
      ) ||
      normalizeGymIdentity(a.address).localeCompare(
        normalizeGymIdentity(b.address),
        "en"
      ) ||
      String(a.id).localeCompare(String(b.id), "en")
  );
}
async function requireDb() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "健身房資料庫未就緒，請稍後重試",
    });
  return db;
}
export async function getSavedGymRows(
  query = "",
  country?: string
): Promise<SavedGymLocation[]> {
  const db = await getDb();
  if (!db) return [];
  const pattern = `%${escapeGymLike(query)}%`;
  const where = and(
    eq(gymLocations.userId, GYM_OWNER_USER_ID),
    query
      ? or(
          sql`${gymLocations.name} ILIKE ${pattern} ESCAPE '\\'`,
          sql`${gymLocations.address} ILIKE ${pattern} ESCAPE '\\'`,
          sql`${gymLocations.brand} ILIKE ${pattern} ESCAPE '\\'`
        )
      : undefined,
    country
      ? sql`lower(${gymLocations.country}) = lower(${country})`
      : undefined
  );
  const rows: SavedGymLocation[] = [];
  for (let offset = 0; ; offset += READ_PAGE_SIZE) {
    const page = await db
      .select(locationFields)
      .from(gymLocations)
      .where(where)
      .orderBy(asc(gymLocations.name), asc(gymLocations.id))
      .limit(READ_PAGE_SIZE)
      .offset(offset);
    rows.push(...page.filter(r => r.userId === GYM_OWNER_USER_ID));
    if (page.length < READ_PAGE_SIZE) break;
  }
  return rows;
}
export async function getSavedGyms(): Promise<GymLocation[]> {
  return mergeGymLocations([(await getSavedGymRows()).map(publicLocation)]);
}

interface ProviderResponse {
  status?: string;
  next_page_token?: string;
  results?: Array<{
    place_id?: string;
    name?: string;
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
    types?: string[];
    business_status?: string;
  }>;
}
interface ProviderResult {
  status: string;
  results: GymLocation[];
  warning?: string;
  nextPageToken?: string;
}
function providerWarning(status: string) {
  return `全球地點供應商暫未提供可用結果（${status}）；仍可搜尋官方及已保存地址，或手動新增地址。稍後重試全球搜尋。`;
}
export async function searchGymProvider(
  input: GymSearchParsed
): Promise<ProviderResult> {
  if (!input.query) return { status: "NOT_REQUESTED", results: [] };
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const request = makeRequest<ProviderResponse>(
      "/maps/api/place/textsearch/json",
      {
        query: [input.query, input.country].filter(Boolean).join(" "),
        type: "gym",
        language: "zh-TW",
        ...(input.pageToken ? { pagetoken: input.pageToken } : {}),
      }
    );
    const response = await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("GYM_PROVIDER_TIMEOUT")),
          GYM_PROVIDER_DEADLINE_MS
        );
      }),
    ]);
    const status =
      response.status && /^[A-Z_]{1,60}$/.test(response.status)
        ? response.status
        : "INVALID_RESPONSE";
    if (status !== "OK" && status !== "ZERO_RESULTS")
      return { status, results: [], warning: providerWarning(status) };
    if (status === "OK" && !Array.isArray(response.results))
      return {
        status: "INVALID_RESPONSE",
        results: [],
        warning: providerWarning("INVALID_RESPONSE"),
      };
    const results: GymLocation[] = [];
    for (const item of (response.results ?? []).slice(0, 20)) {
      if (
        item.business_status === "CLOSED_PERMANENTLY" ||
        (item.types && !item.types.includes("gym"))
      )
        continue;
      const values = {
        name: item.name,
        address: item.formatted_address,
        placeId: item.place_id,
        latitude: item.geometry?.location?.lat,
        longitude: item.geometry?.location?.lng,
      };
      const parsed = gymSaveLocationSchema.safeParse(values);
      if (!parsed.success || !item.place_id) continue;
      const v = parsed.data;
      results.push({
        id: `google:${item.place_id}`,
        savedId: null,
        name: v.name,
        address: v.address,
        country: input.country ?? null,
        brand: /24\s*\/?\s*7\s*fitness/i.test(v.name) ? "24/7 Fitness" : null,
        source: "google_places",
        sourceUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.name)}&query_place_id=${encodeURIComponent(item.place_id)}`,
        placeId: item.place_id,
        latitude: v.latitude ?? null,
        longitude: v.longitude ?? null,
        sourceCheckedAt: new Date().toISOString(),
        createdAt: null,
        updatedAt: null,
      });
    }
    const token =
      response.next_page_token &&
      /^[a-zA-Z0-9_=-]{1,2048}$/.test(response.next_page_token)
        ? response.next_page_token
        : undefined;
    return { status, results, nextPageToken: token };
  } catch (error) {
    // Never return raw errors: proxy errors can contain credentials, response bodies, or internal URLs.
    const message = error instanceof Error ? error.message : "";
    const httpStatus = message.match(/request failed \((\d{3})\b/)?.[1];
    const status =
      message === "GYM_PROVIDER_TIMEOUT"
        ? "TIMEOUT"
        : httpStatus
          ? `HTTP_${httpStatus}`
          : message.includes("credentials missing")
            ? "NOT_CONFIGURED"
            : "UNAVAILABLE";
    return { status, results: [], warning: providerWarning(status) };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
export async function searchGyms(
  raw: GymSearchParsed
): Promise<GymSearchResult> {
  const input = gymSearchSchema.parse(raw);
  const [saved, provider] = await Promise.all([
    getSavedGymRows(input.query, input.country),
    searchGymProvider(input),
  ]);
  const results = input.pageToken
    ? mergeGymLocations([provider.results])
    : mergeGymLocations([
        saved.map(publicLocation),
        officialGymLocations().filter(g =>
          textMatch(g, input.query, input.country)
        ),
        provider.results,
      ]);
  const hasProvider =
    provider.status === "OK" || provider.status === "ZERO_RESULTS";
  return {
    results: results.slice(input.offset, input.offset + input.limit),
    total: results.length,
    source: hasProvider
      ? "官方、已保存及全球地點供應商搜尋"
      : "官方及已保存地址搜尋",
    providerStatus: provider.status,
    ...(provider.warning ? { providerWarning: provider.warning } : {}),
    providerHasMore: !!provider.nextPageToken,
    ...(provider.nextPageToken
      ? { nextPageToken: provider.nextPageToken }
      : {}),
    attribution: hasProvider ? "Google Maps" : null,
    completeWorldwide: false,
  };
}

const LABELS: Record<string, string> = {
  chest: "胸肌",
  back: "背部",
  lats: "背闊肌",
  traps: "斜方肌",
  shoulders: "肩膀",
  biceps: "二頭肌",
  triceps: "三頭肌",
  forearms: "前臂",
  abs: "腹肌",
  obliques: "腹斜肌",
  quads: "股四頭肌",
  hamstrings: "腿後肌",
  glutes: "臀肌",
  calves: "小腿",
  adductors: "內收肌",
  abductors: "外展肌",
  hip_adductors: "髖內收肌",
  hip_abductors: "髖外展肌",
};
export interface GymMachineOption {
  machineKey: string;
  displayName: string;
  nameZh: string;
  equipment: GymEquipmentType;
  aliases: string[];
  guideId: string | null;
  primary: string[];
  secondary: string[];
  primaryLabels: string[];
  secondaryLabels: string[];
  referenceUrls: string[];
}
const GUIDE_REFERENCE: Record<string, number> = {
  "lat-pulldown": 147,
  "seated-row": 704,
  "chest-press": 758,
  "pec-deck": 151,
  "shoulder-press": 560,
  "leg-press": 109,
  "leg-extension": 97,
  "leg-curl": 803,
  "ab-crunch": 3354,
  "triceps-extension": 30395,
  "biceps-curl": 892,
  "hip-adduction": 441,
  "hip-abduction": 873,
  "back-extension": 36276,
  "lateral-raise": 395,
  "incline-press": 346,
  "decline-press": 957,
};
export function getGymMachineCatalog(): GymMachineOption[] {
  const options: GymMachineOption[] = [];
  for (const guide of EXERCISE_GUIDES) {
    const ref = GYMWORK_REFERENCES.find(
      r => r.id === GUIDE_REFERENCE[guide.id]
    );
    const equipment = ref?.equipment[0] ?? "Machine";
    // Shared technique guides intentionally group some related actions. Inventory
    // aliases come only from the exact reference, never from that broad grouping.
    const aliases = ref
      ? Array.from(new Set([ref.name, ...ref.aliases]))
      : [...guide.aliases];
    options.push({
      machineKey: guide.id,
      displayName: ref?.aliases[0] ?? guide.name,
      nameZh: guide.nameZh,
      equipment: equipment as GymEquipmentType,
      aliases,
      guideId: guide.id,
      primary: [...guide.primary],
      secondary: [...guide.secondary],
      primaryLabels: guide.primary.map(k => LABELS[k] ?? k),
      secondaryLabels: guide.secondary.map(k => LABELS[k] ?? k),
      referenceUrls: Array.from(
        new Set([...(ref ? [ref.url] : []), ...guide.sources])
      ),
    });
  }
  for (const ref of GYMWORK_REFERENCES) {
    const guide = ref.aliases
      .map(a => getExerciseGuide(a, ref.equipment[0]))
      .find(Boolean);
    const exactMuscles = getExerciseMuscles({
      name: ref.aliases[0] ?? ref.name,
      equipment: ref.equipment[0],
      muscleGroup: "other",
    });
    const primary =
      guide?.primary ??
      (exactMuscles.basis === "exercise" ? exactMuscles.primary : []);
    const secondary =
      guide?.secondary ??
      (exactMuscles.basis === "exercise" ? exactMuscles.secondary : []);
    const exactNameZh =
      ref.aliases.find(a => /[\u3400-\u9fff]/.test(a)) ??
      (guide && GUIDE_REFERENCE[guide.id] === ref.id ? guide.nameZh : ref.name);
    options.push({
      machineKey: `gymwork-${ref.id}`,
      displayName: ref.aliases[0] ?? ref.name,
      nameZh: exactNameZh,
      equipment: ref.equipment[0] as GymEquipmentType,
      aliases: Array.from(new Set([ref.name, ...ref.aliases])),
      guideId: guide?.id ?? null,
      primary: [...primary],
      secondary: [...secondary],
      primaryLabels: primary.map(k => LABELS[k] ?? k),
      secondaryLabels: secondary.map(k => LABELS[k] ?? k),
      referenceUrls: [ref.url],
    });
  }
  return options;
}
export function feasibleGymExercises(
  rows: GymEquipmentRecord[]
): GymFeasibleExercise[] {
  const catalog = getGymMachineCatalog();
  return rows.flatMap(row => {
    if (!["owner_confirmed", "photo_confirmed"].includes(row.source)) return [];
    const option = catalog.find(
      o => o.machineKey === row.machineKey && o.equipment === row.equipment
    );
    if (!option) return [];
    return [
      {
        machineKey: row.machineKey,
        equipmentId: row.id,
        guideId: option.guideId,
        name: option.displayName,
        nameZh: option.nameZh,
        equipment: row.equipment,
        aliases: option.aliases,
        primary: option.primary,
        secondary: option.secondary,
        primaryLabels: option.primaryLabels,
        secondaryLabels: option.secondaryLabels,
        referenceUrls: option.referenceUrls,
        confirmationSource: row.source,
      },
    ];
  });
}
async function ownedGym(id: number): Promise<SavedGymLocation> {
  const db = await requireDb();
  const [row] = await db
    .select(locationFields)
    .from(gymLocations)
    .where(
      and(eq(gymLocations.id, id), eq(gymLocations.userId, GYM_OWNER_USER_ID))
    )
    .limit(1);
  if (!row || row.userId !== GYM_OWNER_USER_ID)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "找不到已保存的健身房，請先儲存地址",
    });
  return row;
}
function branchOfficialInventory(gym: GymLocation): {
  snapshot: GymOfficialInventorySnapshot;
  machines: GymOfficialMachine[];
} | null {
  const seeds = officialGymLocations();
  const exact = seeds.find(
    s =>
      s.id === gym.id ||
      gymIdentityKey(s.name, s.address) ===
        gymIdentityKey(gym.name, gym.address)
  );
  // A URL can identify a branch only when exactly one reviewed seed owns it.
  // Shared brand/directory URLs must never leak another branch's inventory.
  const sourceMatches = gym.sourceUrl
    ? seeds.filter(s => s.sourceUrl === gym.sourceUrl)
    : [];
  const seed =
    exact ?? (sourceMatches.length === 1 ? sourceMatches[0] : undefined);
  if (!seed) return null;
  const rawId = String(seed.id).replace(/^official:/, "");
  const snapshots = GYM_OFFICIAL_INVENTORY as
    | GymOfficialInventorySnapshot[]
    | Record<string, GymOfficialInventorySnapshot>;
  const snapshot = Array.isArray(snapshots)
    ? snapshots.find(s => s.gymReferenceId === rawId)
    : snapshots[rawId];
  if (
    !snapshot ||
    snapshot.gymReferenceId !== rawId ||
    snapshot.country !== seed.country ||
    snapshot.status !== "verified" ||
    !Array.isArray(snapshot.machines) ||
    !isSafeGymSourceUrl(snapshot.sourceUrl) ||
    Number.isNaN(Date.parse(snapshot.checkedAt))
  )
    return null;
  const nullableText = z.string().max(255).nullable();
  const count = z.number().int().min(0).max(100000).nullable();
  const machineSchema = z.object({
    id: z
      .string()
      .min(1)
      .max(150)
      .regex(/^[a-zA-Z0-9_-]+(?::[a-zA-Z0-9_-]+)*$/),
    name: cleanText(255),
    nameZh: cleanText(255).optional(),
    manufacturer: nullableText,
    model: nullableText,
    category: nullableText,
    total: count,
    normal: count,
    damaged: count,
    sourceUrl,
  });
  const machines = snapshot.machines.flatMap(m => {
    const parsed = machineSchema.safeParse(m);
    return parsed.success ? [parsed.data] : [];
  });
  if (!machines.length) return null;
  return { snapshot, machines };
}
function exactOfficialMachineOption(
  machine: GymOfficialMachine
): GymMachineOption | undefined {
  if (machine.normal === 0 || machine.total === 0) return undefined;
  const publishedNames = [machine.name, machine.nameZh ?? ""].map(
    normalizeGymIdentity
  );
  const ref = GYMWORK_REFERENCES.find(r =>
    [r.name, ...r.aliases].some(a =>
      publishedNames.includes(normalizeGymIdentity(a))
    )
  );
  if (!ref) return undefined;
  const primaryGuide = Object.keys(GUIDE_REFERENCE).find(
    id => GUIDE_REFERENCE[id] === ref.id
  );
  return getGymMachineCatalog().find(
    c => c.machineKey === (primaryGuide ?? `gymwork-${ref.id}`)
  );
}
function officialFeasibleExercises(
  snapshot: GymOfficialInventorySnapshot,
  machines: GymOfficialMachine[],
  confirmed: GymEquipmentRecord[]
): GymFeasibleExercise[] {
  const ownerKeys = new Set(confirmed.map(r => r.machineKey));
  return machines.flatMap(machine => {
    const exact = exactOfficialMachineOption(machine);
    if (!exact || ownerKeys.has(exact.machineKey)) return [];
    return [
      {
        machineKey: exact.machineKey,
        equipmentId: `official:${snapshot.gymReferenceId}:${machine.id}`,
        guideId: exact.guideId,
        name: exact.displayName,
        nameZh: exact.nameZh,
        equipment: exact.equipment,
        aliases: exact.aliases,
        primary: exact.primary,
        secondary: exact.secondary,
        primaryLabels: exact.primaryLabels,
        secondaryLabels: exact.secondaryLabels,
        referenceUrls: Array.from(
          new Set([snapshot.sourceUrl, ...exact.referenceUrls])
        ),
        confirmationSource: "official_inventory" as const,
        availabilityCaution:
          machine.normal == null || machine.total == null
            ? "官方未提供可用數量；此為名稱對應而非可用保證，請在現場核實。"
            : "官方器材數量為來源日期快照，並非即時可用保證；請在現場核實。",
      },
    ];
  });
}
export async function getGymEquipment(
  gymId: number | string
): Promise<GymEquipmentResult> {
  gymId = gymIdSchema.parse(gymId);
  if (typeof gymId === "string" && gymId.startsWith("247fitness:"))
    gymId = `official:${gymId}`;
  let gym: GymLocation;
  let equipment: GymEquipmentRecord[] = [];
  if (typeof gymId === "number") {
    gym = publicLocation(await ownedGym(gymId));
    const db = await requireDb();
    for (let offset = 0; ; offset += READ_PAGE_SIZE) {
      const page = await db
        .select(equipmentFields)
        .from(gymEquipment)
        .where(
          and(
            eq(gymEquipment.userId, GYM_OWNER_USER_ID),
            eq(gymEquipment.gymId, gymId)
          )
        )
        .orderBy(asc(gymEquipment.id))
        .limit(READ_PAGE_SIZE)
        .offset(offset);
      equipment.push(
        ...page
          .filter(
            r =>
              r.userId === GYM_OWNER_USER_ID &&
              r.gymId === gymId &&
              ["owner_confirmed", "photo_confirmed"].includes(r.source)
          )
          .map(publicEquipment)
      );
      if (page.length < READ_PAGE_SIZE) break;
    }
  } else {
    const official = officialGymLocations().find(g => g.id === gymId);
    if (!official)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "請先明確選擇並儲存此地址，才可確認分店器材",
      });
    gym = official;
  }
  const published = branchOfficialInventory(gym);
  const officialEquipment = published?.machines ?? [];
  const availableExercises = [
    ...feasibleGymExercises(equipment),
    ...(published
      ? officialFeasibleExercises(
          published.snapshot,
          officialEquipment,
          equipment
        )
      : []),
  ];
  const mapped = new Set(availableExercises.map(e => e.machineKey));
  return {
    gym,
    equipment,
    officialEquipment,
    officialInventory: published
      ? {
          sourceUrl: published.snapshot.sourceUrl,
          checkedAt: new Date(published.snapshot.checkedAt).toISOString(),
          status: "verified",
          gymReferenceId: published.snapshot.gymReferenceId,
        }
      : null,
    availableExercises,
    coverage: {
      status: equipment.length
        ? "partially_confirmed"
        : officialEquipment.length
          ? "official_snapshot"
          : "unknown",
      confirmedEquipmentCount: equipment.length,
      officialEquipmentCount: officialEquipment.length,
      mappedEquipmentCount: mapped.size,
      unmappedMachineKeys: [
        ...equipment
          .filter(e => !mapped.has(e.machineKey))
          .map(e => e.machineKey),
        ...officialEquipment
          .filter(e => !exactOfficialMachineOption(e))
          .map(e => `official:${e.id}`),
      ],
      completeInventory: false,
      message: published
        ? "官方分店器材快照及個別確認記錄；只按精確對應提供動作，不保證即時或完整，請在現場核實。"
        : equipment.length
          ? "只按此分店已明確確認的器材提供動作；不代表完整器材清單。"
          : "此分店器材尚未確認；不會從品牌、地址或其他分店推測。請先儲存地址，再逐項確認器材。",
    },
  };
}
export async function saveGymLocation(
  raw: GymSaveParsed
): Promise<GymLocation> {
  const input = gymSaveLocationSchema.parse(raw);
  const db = await requireDb();
  const identityKey = gymIdentityKey(input.name, input.address);
  // Identity is normalized name/address; provider keys also have an owner-scoped
  // unique constraint. A new provider key can attach to an existing manual row.
  const where = and(
    eq(gymLocations.userId, GYM_OWNER_USER_ID),
    or(
      eq(gymLocations.identityKey, identityKey),
      input.placeId ? eq(gymLocations.placeId, input.placeId) : undefined
    )
  );
  const [existing] = await db
    .select(locationFields)
    .from(gymLocations)
    .where(where)
    .orderBy(asc(gymLocations.id))
    .limit(1);
  if (existing?.userId === GYM_OWNER_USER_ID) return publicLocation(existing);
  const matchingSeed = officialGymLocations().find(
    g => gymIdentityKey(g.name, g.address) === identityKey
  );
  const providerSelection =
    !!input.placeId ||
    !!input.sourceUrl?.startsWith("https://www.google.com/maps/");
  const [inserted] = await db
    .insert(gymLocations)
    .values({
      ...input,
      userId: GYM_OWNER_USER_ID,
      identityKey,
      // Explicit selection/save creates owner-maintained address text. Do not persist
      // Google geometry or automatic metadata: place IDs can be retained separately.
      latitude:
        !providerSelection || matchingSeed ? (input.latitude ?? null) : null,
      longitude:
        !providerSelection || matchingSeed ? (input.longitude ?? null) : null,
      source: matchingSeed ? "official_seed" : "owner_saved",
      sourceCheckedAt: matchingSeed?.sourceCheckedAt
        ? new Date(matchingSeed.sourceCheckedAt)
        : null,
    })
    .onConflictDoNothing()
    .returning(locationFields);
  if (inserted) return publicLocation(inserted);
  const [duplicate] = await db
    .select(locationFields)
    .from(gymLocations)
    .where(where)
    .orderBy(asc(gymLocations.id))
    .limit(1);
  if (!duplicate)
    throw new TRPCError({
      code: "CONFLICT",
      message: "地址儲存衝突，請重新搜尋已保存地址",
    });
  return publicLocation(duplicate);
}
export async function upsertGymEquipment(
  raw: GymUpsertParsed
): Promise<GymEquipmentRecord> {
  const input = gymUpsertEquipmentSchema.parse(raw);
  await ownedGym(input.gymId);
  const db = await requireDb();
  const known = getGymMachineCatalog().find(
    o => o.machineKey === input.machineKey
  );
  if (known && known.equipment !== input.equipment)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "器材種類必須符合此精確器械代碼；不可暗中替換動作",
    });
  const values = {
    ...input,
    userId: GYM_OWNER_USER_ID,
    notes: input.notes ?? null,
    sourceUrl: input.sourceUrl ?? null,
    confirmedAt: new Date(),
    updatedAt: new Date(),
  };
  const [row] = await db
    .insert(gymEquipment)
    .values(values)
    .onConflictDoUpdate({
      target: [
        gymEquipment.userId,
        gymEquipment.gymId,
        gymEquipment.machineKey,
      ],
      set: {
        displayName: values.displayName,
        equipment: values.equipment,
        source: values.source,
        notes: values.notes,
        sourceUrl: values.sourceUrl,
        confirmedAt: values.confirmedAt,
        updatedAt: values.updatedAt,
      },
    })
    .returning(equipmentFields);
  if (!row)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "器材確認未能儲存",
    });
  return publicEquipment(row);
}
export async function deleteGymEquipment(
  id: number
): Promise<{ success: true }> {
  id = gymNumericIdSchema.parse(id);
  const db = await requireDb();
  const [row] = await db
    .delete(gymEquipment)
    .where(
      and(eq(gymEquipment.id, id), eq(gymEquipment.userId, GYM_OWNER_USER_ID))
    )
    .returning({ id: gymEquipment.id });
  if (!row)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "找不到此擁有人的器材確認記錄",
    });
  return { success: true };
}
