import { useEffect, useId, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Dumbbell,
  ExternalLink,
  Globe2,
  Loader2,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useIsOwner } from "@/contexts/OwnerContext";
import {
  prepareReportPhoto,
  type PreparedReportPhoto,
} from "@/lib/prepareReportPhoto";
import { normalizeGymLocation } from "@/components/GymLocationInput";
import { getGymworkReference } from "@shared/gymworkReferences";
import type {
  GymFeasibleExercise,
  GymLocation,
  GymSearchInput,
} from "@shared/gymDirectory";

export interface GymDirectoryExercise {
  name: string;
  nameZh?: string;
  muscleGroup: string;
  equipment: string;
}
export interface GymDirectoryPanelProps {
  /** Supplies text for a NEW session only; this component never updates sessions. */
  onSelectLocation?: (location: string) => void;
  onOpenExercise?: (exercise: GymDirectoryExercise) => void;
}

const sourceLabels: Record<GymLocation["source"], string> = {
  official_seed: "官方分店目錄",
  google_places: "Google Places",
  owner_saved: "使用者保存地址",
};
const field =
  "min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50";
const action =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
const primaryAction =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
function safeLink(value?: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
function dateLabel(value?: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    dateStyle: "medium",
  }).format(new Date(value));
}
function Status({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <div
      role={error ? "alert" : "status"}
      className={`rounded-xl border p-3 text-sm leading-6 ${error ? "border-red-200 bg-red-50 text-red-800" : "border-blue-100 bg-blue-50 text-slate-700"}`}
    >
      {children}
    </div>
  );
}

export default function GymDirectoryPanel({
  onSelectLocation,
  onOpenExercise,
}: GymDirectoryPanelProps) {
  const id = useId();
  const owner = useIsOwner();
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("24/7 Fitness");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [submitted, setSubmitted] = useState<GymSearchInput | null>(null);
  const [selected, setSelected] = useState<GymLocation | null>(null);
  const [selectionBusy, setSelectionBusy] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [officialSearch, setOfficialSearch] = useState("");
  const [officialLimit, setOfficialLimit] = useState(20);
  useEffect(() => {
    setOfficialSearch("");
    setOfficialLimit(20);
  }, [selected?.id]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ name: "", address: "", country: "" });
  const [addOpen, setAddOpen] = useState(false);
  const [machineKey, setMachineKey] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [equipmentBusy, setEquipmentBusy] = useState(false);
  const [equipmentError, setEquipmentError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [proposal, setProposal] = useState<{
    name: string;
    nameZh: string;
    equipment: string;
    confidence: string;
  } | null>(null);
  const selectionSequence = useRef(0);
  const photoSequence = useRef(0);
  const preparedPhoto = useRef<PreparedReportPhoto | null>(null);
  useEffect(
    () => () => {
      selectionSequence.current++;
      photoSequence.current++;
    },
    []
  );

  const search = trpc.gym.search.useQuery(
    submitted ?? { query: "24/7 Fitness", limit: 20, offset: 0 },
    { enabled: submitted !== null, retry: false }
  );
  const saved = trpc.gym.getSaved.useQuery(undefined, { retry: false });
  const savedId =
    selected?.savedId ??
    (typeof selected?.id === "number" ? selected.id : null);
  const inventory = trpc.gym.getEquipment.useQuery(
    { gymId: savedId ?? 0 },
    { enabled: savedId !== null, retry: false }
  );
  const catalog = trpc.gym.getMachineCatalog.useQuery(undefined, {
    enabled: addOpen && savedId !== null,
    retry: false,
  });
  const machineOptions = (catalog.data ?? []).map(option => ({
    key: option.machineKey,
    label: `${option.nameZh} · ${option.displayName} · ${option.equipment}`,
    name: option.nameZh,
    equipment: option.equipment,
  }));
  const saveLocation = trpc.gym.saveLocation.useMutation();
  const upsertEquipment = trpc.gym.upsertEquipment.useMutation();
  const deleteEquipment = trpc.gym.deleteEquipment.useMutation();
  const identifyPhoto = trpc.workout.identifyExerciseFromPhoto.useMutation();

  function resetEquipmentDraft() {
    photoSequence.current++;
    preparedPhoto.current = null;
    setPhotoName("");
    setPhotoError(null);
    setProposal(null);
    setPhotoBusy(false);
    setMachineKey("");
    setNotes("");
    setConfirmed(false);
    setDeleteId(null);
    setEquipmentError(null);
  }
  async function selectBranch(location: GymLocation) {
    const sequence = ++selectionSequence.current;
    resetEquipmentDraft();
    setSelectionError(null);
    setSelectionBusy(true);
    try {
      const isSaved =
        location.savedId !== null || typeof location.id === "number";
      if (!isSaved && !owner)
        throw new Error("此地址尚未保存；只有資料擁有人可以保存分店。");
      const result = isSaved
        ? location
        : await saveLocation.mutateAsync({
            name: location.name,
            address: location.address,
            ...(location.country ? { country: location.country } : {}),
            ...(location.brand ? { brand: location.brand } : {}),
            ...(safeLink(location.sourceUrl)
              ? { sourceUrl: safeLink(location.sourceUrl) }
              : {}),
            ...(location.placeId ? { placeId: location.placeId } : {}),
            ...(location.latitude !== null
              ? { latitude: location.latitude }
              : {}),
            ...(location.longitude !== null
              ? { longitude: location.longitude }
              : {}),
          });
      if (sequence !== selectionSequence.current) return;
      setSelected(result);
      setAddOpen(false);
      if (!isSaved) void utils.gym.getSaved.invalidate();
    } catch (error) {
      if (sequence === selectionSequence.current)
        setSelectionError(errorText(error, "未能保存分店；請重試。"));
    } finally {
      if (sequence === selectionSequence.current) setSelectionBusy(false);
    }
  }
  async function saveManual() {
    const sequence = ++selectionSequence.current;
    resetEquipmentDraft();
    setSelectionError(null);
    setSelectionBusy(true);
    try {
      const result = await saveLocation.mutateAsync({
        name: manual.name.trim(),
        address: manual.address.trim(),
        ...(manual.country.trim() ? { country: manual.country.trim() } : {}),
      });
      if (sequence !== selectionSequence.current) return;
      setSelected(result);
      setManualOpen(false);
      setAddOpen(false);
      void utils.gym.getSaved.invalidate();
    } catch (error) {
      if (sequence === selectionSequence.current)
        setSelectionError(errorText(error, "未能保存地址；請核對後重試。"));
    } finally {
      if (sequence === selectionSequence.current) setSelectionBusy(false);
    }
  }
  async function confirmMachine() {
    const option = machineOptions.find(item => item.key === machineKey);
    if (
      !owner ||
      savedId === null ||
      !option ||
      !confirmed ||
      equipmentBusy ||
      selectionBusy
    )
      return;
    const sequence = selectionSequence.current;
    setEquipmentBusy(true);
    setEquipmentError(null);
    try {
      await upsertEquipment.mutateAsync({
        gymId: savedId,
        machineKey: option.key,
        displayName: option.name,
        equipment: option.equipment,
        source: "owner_confirmed",
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      await utils.gym.getEquipment.invalidate({ gymId: savedId });
      if (sequence === selectionSequence.current) {
        resetEquipmentDraft();
        setAddOpen(false);
      }
    } catch (error) {
      if (sequence === selectionSequence.current)
        setEquipmentError(errorText(error, "器械確認未能保存；請重試。"));
    } finally {
      setEquipmentBusy(false);
    }
  }
  async function removeMachine() {
    if (
      !owner ||
      deleteId === null ||
      savedId === null ||
      equipmentBusy ||
      selectionBusy
    )
      return;
    const sequence = selectionSequence.current;
    setEquipmentBusy(true);
    setEquipmentError(null);
    try {
      await deleteEquipment.mutateAsync({ id: deleteId });
      await utils.gym.getEquipment.invalidate({ gymId: savedId });
      if (sequence === selectionSequence.current) setDeleteId(null);
    } catch (error) {
      if (sequence === selectionSequence.current)
        setEquipmentError(errorText(error, "未能刪除器械；請重試。"));
    } finally {
      setEquipmentBusy(false);
    }
  }
  async function proposeFromPhoto(file?: File) {
    const sequence = ++photoSequence.current;
    setPhotoBusy(true);
    setPhotoError(null);
    setProposal(null);
    setConfirmed(false);
    if (file) {
      preparedPhoto.current = null;
      setPhotoName(file.name);
    }
    try {
      const photo = file
        ? await prepareReportPhoto(file)
        : preparedPhoto.current;
      if (sequence !== photoSequence.current) return;
      if (!photo) throw new Error("請先選取器械相片。");
      // Bound the actual JSON request, including base64 overhead, not only the original file.
      if (
        new Blob([
          JSON.stringify({ base64: photo.base64, mimeType: photo.mimeType }),
        ]).size >= 3_000_000
      )
        throw new Error(
          "相片傳送內容須小於 3 MB；請選取較低解像度相片後重試。"
        );
      preparedPhoto.current = photo;
      const result = await identifyPhoto.mutateAsync({
        base64: photo.base64,
        mimeType: photo.mimeType,
      });
      if (sequence !== photoSequence.current) return;
      setProposal(result);
      // No automatic match or persistence: the owner must choose a catalogue item and confirm.
    } catch (error) {
      if (sequence === photoSequence.current)
        setPhotoError(errorText(error, "未能辨識相片；可重試或手動選擇器械。"));
    } finally {
      if (sequence === photoSequence.current) setPhotoBusy(false);
    }
  }
  function openExercise(exercise: GymFeasibleExercise) {
    onOpenExercise?.({
      name: exercise.name,
      nameZh: exercise.nameZh,
      muscleGroup: exercise.primary[0] || "other",
      equipment: exercise.equipment,
    });
  }
  const machines = inventory.data?.equipment ?? [];
  const officialMachines = inventory.data?.officialEquipment ?? [];
  const filteredOfficialMachines = officialMachines.filter(m =>
    [m.name, m.nameZh, m.category, m.model, m.manufacturer]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(officialSearch.trim().toLowerCase())
  );
  const officialSnapshot = inventory.data?.officialInventory;
  const availableExercises = inventory.data?.availableExercises ?? [];
  const branchBusy = selectionBusy || equipmentBusy;

  return (
    <section
      data-gym-directory
      className="gym-directory min-w-0 space-y-5 rounded-3xl bg-slate-50 p-3 text-slate-900 sm:p-5"
    >
      <style>{`.gym-directory{color-scheme:light;overflow-wrap:anywhere}.gym-directory *{box-sizing:border-box;min-width:0}.gym-directory button,.gym-directory input:not([type=checkbox]),.gym-directory select,.gym-directory a{min-height:44px}.gym-directory button{white-space:normal;touch-action:manipulation}.gym-directory button:focus-visible,.gym-directory a:focus-visible{outline:2px solid #2563eb;outline-offset:3px}.gym-directory input[type=checkbox]{width:20px;height:20px;flex-shrink:0;accent-color:#2563eb}`}</style>
      <header className="rounded-2xl border border-blue-100 bg-white p-5">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wider text-blue-600">
          <Globe2 className="h-4 w-4" aria-hidden="true" /> GYM DIRECTORY ·
          分店實況
        </div>
        <h2 className="text-xl font-bold">搜尋健身室，核對你的分店器械</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          優先搜尋 24/7
          Fitness，也可輸入全球其他健身室。地址可查，不代表已知道現場有哪些機器。
        </p>
      </header>

      <section
        aria-label="搜尋健身室地址"
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
      >
        <form
          onSubmit={event => {
            event.preventDefault();
            if (!query.trim()) return;
            const next = {
              query: [query.trim(), city.trim()].filter(Boolean).join(" "),
              ...(country.trim() ? { country: country.trim() } : {}),
              limit: 20,
              offset: 0,
            };
            if (submitted && JSON.stringify(submitted) === JSON.stringify(next))
              void search.refetch();
            else setSubmitted(next);
          }}
          className="space-y-3"
        >
          <div>
            <label
              htmlFor={`${id}-query`}
              className="mb-1.5 block text-sm font-semibold"
            >
              健身室名稱／地址
            </label>
            <input
              id={`${id}-query`}
              aria-label="健身室名稱／地址"
              className={field}
              value={query}
              maxLength={160}
              onChange={event => setQuery(event.target.value)}
              placeholder="例如 24/7 Fitness、Anytime Fitness"
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`${id}-city`}
                className="mb-1.5 block text-sm font-semibold"
              >
                城市（選填）
              </label>
              <input
                id={`${id}-city`}
                aria-label="城市（選填）"
                className={field}
                value={city}
                maxLength={80}
                onChange={event => setCity(event.target.value)}
                placeholder="例如 London、台北、香港"
              />
            </div>
            <div>
              <label
                htmlFor={`${id}-country`}
                className="mb-1.5 block text-sm font-semibold"
              >
                國家／地區（選填）
              </label>
              <input
                id={`${id}-country`}
                aria-label="國家／地區（選填）"
                className={field}
                value={country}
                maxLength={80}
                onChange={event => setCountry(event.target.value)}
                placeholder="留空不限國家／地區"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className={primaryAction}
              disabled={!query.trim() || search.isFetching}
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              {search.isFetching ? "搜尋中…" : "搜尋分店"}
            </button>
            {owner && (
              <button
                type="button"
                className={action}
                aria-expanded={manualOpen}
                onClick={() => setManualOpen(value => !value)}
                disabled={branchBusy}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                手動新增地址
              </button>
            )}
          </div>
        </form>
        <p className="text-xs leading-5 text-slate-500">
          搜尋經伺服器查詢官方目錄、已保存地址與 Google
          Places（如供應商可用）。每次最多顯示 20
          個合併結果；不是完整全球名錄，不讀取 GPS，搜尋不會保存資料。
        </p>
        {manualOpen && (
          <form
            aria-label="手動新增健身室"
            className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3"
            onSubmit={event => {
              event.preventDefault();
              if (
                owner &&
                manual.name.trim() &&
                manual.address.trim() &&
                !branchBusy
              )
                void saveManual();
            }}
          >
            <h3 className="text-sm font-bold">新增你親自核對的地址</h3>
            <div>
              <label
                htmlFor={`${id}-manual-name`}
                className="mb-1 block text-xs font-semibold"
              >
                分店名稱
              </label>
              <input
                id={`${id}-manual-name`}
                className={field}
                aria-label="手動分店名稱"
                value={manual.name}
                maxLength={200}
                required
                onChange={event =>
                  setManual({ ...manual, name: event.target.value })
                }
              />
            </div>
            <div>
              <label
                htmlFor={`${id}-manual-address`}
                className="mb-1 block text-xs font-semibold"
              >
                完整地址
              </label>
              <input
                id={`${id}-manual-address`}
                className={field}
                aria-label="手動完整地址"
                value={manual.address}
                maxLength={500}
                required
                onChange={event =>
                  setManual({ ...manual, address: event.target.value })
                }
              />
            </div>
            <div>
              <label
                htmlFor={`${id}-manual-country`}
                className="mb-1 block text-xs font-semibold"
              >
                國家／地區（選填）
              </label>
              <input
                id={`${id}-manual-country`}
                className={field}
                aria-label="手動國家／地區"
                value={manual.country}
                maxLength={80}
                onChange={event =>
                  setManual({ ...manual, country: event.target.value })
                }
              />
            </div>
            <p className="text-xs leading-5 text-slate-600">
              保存地址不會自動新增任何器械，亦不代表官方認證。
            </p>
            <button
              type="submit"
              className={primaryAction}
              disabled={
                !manual.name.trim() || !manual.address.trim() || branchBusy
              }
            >
              保存地址及查看器械
            </button>
          </form>
        )}
        {!submitted && (
          <Status>
            輸入名稱後按「搜尋分店」。城市與國家均可留空，不預設只搜尋香港。
          </Status>
        )}
        {submitted && search.isFetching && (
          <Status>
            <Loader2
              className="mr-2 inline h-4 w-4 animate-spin"
              aria-hidden="true"
            />
            正在查詢分店地址…
          </Status>
        )}
        {submitted && search.error && (
          <Status error>
            {search.error.message}
            <button
              type="button"
              className={`${action} mt-2 block`}
              onClick={() => void search.refetch()}
              disabled={search.isFetching}
            >
              重試搜尋
            </button>
          </Status>
        )}
        {submitted && search.data && !search.error && (
          <>
            <Status>
              <p>{search.data.source}</p>
              <p>供應商狀態：{search.data.providerStatus}</p>
              {search.data.providerWarning && (
                <p>{search.data.providerWarning}</p>
              )}
              <p>
                官方目錄及 Google Places
                的覆蓋並不完整；地址及營業情況請向分店核對。
                {search.data.providerHasMore
                  ? "供應商可能仍有其他結果；可加上城市或更精確名稱縮窄搜尋。"
                  : ""}
              </p>
            </Status>
            {search.data.results.length === 0 ? (
              <Status>
                未找到符合條件的地址。請調整名稱／城市／國家，或手動新增；這不表示當地沒有健身室。
              </Status>
            ) : (
              <ul
                aria-label="分店搜尋結果"
                className="grid grid-cols-1 gap-3 lg:grid-cols-2"
              >
                {search.data.results.map(location => (
                  <li
                    key={location.id}
                    className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200 p-4"
                  >
                    <div>
                      <div className="mb-2 flex flex-wrap gap-2">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                          {sourceLabels[location.source]}
                        </span>
                        {location.brand && (
                          <span className="rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-700">
                            {location.brand}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold">{location.name}</h3>
                      <p className="mt-1 flex items-start gap-2 text-sm leading-6 text-slate-600">
                        <MapPin
                          className="mt-1 h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{location.address}</span>
                      </p>
                      {location.country && (
                        <p className="mt-1 text-xs text-slate-500">
                          {location.country}
                        </p>
                      )}
                      {dateLabel(location.sourceCheckedAt) && (
                        <p className="mt-1 text-xs text-slate-500">
                          來源核對：{dateLabel(location.sourceCheckedAt)}
                        </p>
                      )}
                    </div>
                    {safeLink(location.sourceUrl) && (
                      <a
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600"
                        href={safeLink(location.sourceUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        地址來源
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    )}
                    <button
                      type="button"
                      className={`${action} mt-auto w-full`}
                      disabled={
                        branchBusy ||
                        (!owner &&
                          location.savedId === null &&
                          typeof location.id !== "number")
                      }
                      onClick={() => void selectBranch(location)}
                    >
                      選擇分店／保存及查看
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {(search.data.attribution === "Google Maps" ||
              search.data.results.some(
                location => location.source === "google_places"
              )) && (
              <p
                data-provider-attribution
                className="text-sm font-medium text-slate-500"
              >
                地點資料由{" "}
                <span className="font-bold text-slate-700">Google Maps</span>{" "}
                提供（Google Places）。官方目錄及你的已保存資料另行標示。
              </p>
            )}
            {submitted && search.data.total > 20 && (
              <nav
                aria-label="地址結果分頁"
                className="flex flex-wrap items-center gap-2"
              >
                <button
                  type="button"
                  className={action}
                  disabled={search.isFetching || (submitted.offset ?? 0) === 0}
                  onClick={() =>
                    setSubmitted({
                      ...submitted,
                      offset: Math.max(0, (submitted.offset ?? 0) - 20),
                    })
                  }
                >
                  上一頁地址
                </button>
                <span className="text-xs leading-5 text-slate-500">
                  這次合併搜尋共有 {search.data.total} 個地址；第{" "}
                  {Math.floor((submitted.offset ?? 0) / 20) + 1}{" "}
                  頁，不代表全球全部結果。
                </span>
                <button
                  type="button"
                  className={action}
                  disabled={
                    search.isFetching ||
                    (submitted.offset ?? 0) + search.data.results.length >=
                      search.data.total
                  }
                  onClick={() =>
                    setSubmitted({
                      ...submitted,
                      offset: (submitted.offset ?? 0) + 20,
                    })
                  }
                >
                  下一頁地址
                </button>
              </nav>
            )}
            {submitted && search.data.nextPageToken && (
              <button
                type="button"
                className={action}
                disabled={search.isFetching}
                onClick={() =>
                  setSubmitted({
                    ...submitted,
                    offset: 0,
                    pageToken: search.data!.nextPageToken,
                  })
                }
              >
                查看更多 Google Places 健身室
              </button>
            )}
          </>
        )}
        {selectionBusy && <Status>正在保存及開啟分店…</Status>}
        {selectionError && (
          <Status error>
            {selectionError}{" "}
            請按原分店的「選擇分店／保存及查看」或手動保存按鈕重試。
          </Status>
        )}
      </section>

      <section
        aria-label="已保存分店"
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
      >
        <h3 className="font-bold">我的已保存分店</h3>
        {saved.isLoading ? (
          <Status>正在讀取已保存地址…</Status>
        ) : saved.error ? (
          <Status error>
            {saved.error.message}
            <button
              type="button"
              className={`${action} mt-2`}
              onClick={() => void saved.refetch()}
            >
              重試讀取
            </button>
          </Status>
        ) : !saved.data?.length ? (
          <p className="text-sm leading-6 text-slate-500">
            尚未保存分店。搜尋和瀏覽不會自動建立紀錄。
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {saved.data.map(location => (
              <li key={location.id}>
                <button
                  type="button"
                  className={`${action} w-full flex-col items-start text-left`}
                  disabled={branchBusy}
                  aria-pressed={selected?.id === location.id}
                  onClick={() => void selectBranch(location)}
                >
                  <span className="font-semibold">{location.name}</span>
                  <span className="text-xs font-normal leading-5 text-slate-500">
                    {location.address}
                  </span>
                  <span className="text-xs text-blue-600">
                    選擇已保存分店及查看
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <section
          aria-label="所選分店器械"
          className="space-y-4 rounded-2xl border border-blue-200 bg-white p-4 sm:p-5"
        >
          <header className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              所選分店 · 獨立確認
            </div>
            <h3 className="text-lg font-bold">{selected.name}</h3>
            <p className="text-sm leading-6 text-slate-600">
              {selected.address}
            </p>
            <p className="text-xs text-slate-500">
              只顯示這個地址的器械紀錄，不沿用同品牌其他分店或全連鎖設備。
            </p>
            {onSelectLocation && (
              <button
                type="button"
                className={action}
                disabled={selectionBusy}
                onClick={() =>
                  onSelectLocation(
                    normalizeGymLocation(
                      `${selected.name} · ${selected.address}`
                    )
                  )
                }
              >
                <MapPin className="h-4 w-4" aria-hidden="true" />
                用作新訓練地點
              </button>
            )}
            {onSelectLocation && (
              <p className="text-xs text-slate-500">
                只傳送地點文字給新訓練表單；不修改現有或過往訓練。
              </p>
            )}
          </header>
          {inventory.isLoading || inventory.isFetching ? (
            <Status>正在讀取此分店器械…</Status>
          ) : inventory.error ? (
            <Status error>
              {inventory.error.message}
              <button
                type="button"
                className={`${action} mt-2`}
                onClick={() => void inventory.refetch()}
              >
                重試器械清單
              </button>
            </Status>
          ) : !inventory.data ? (
            <Status>尚未取得分店器械資料，不能判定可用動作。</Status>
          ) : (
            <>
              <Status>
                {inventory.data.coverage.message}
                <p>
                  擁有人已確認 {inventory.data.coverage.confirmedEquipmentCount}{" "}
                  項； 官方已公開{" "}
                  {inventory.data.coverage.officialEquipmentCount ?? 0} 項。
                  官方快照與擁有人確認分開標示；不是即時完整器械盤點。
                  {inventory.data.coverage.status === "unknown"
                    ? "此分店器械未知，沒有已確認機器；不會推測或生成動作。"
                    : "現場狀況可能改變，訓練前請再次核對。"}
                </p>
              </Status>
              <section
                aria-label="官方分店器械"
                className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4"
              >
                <h4 className="flex items-center gap-2 font-bold">
                  <ShieldCheck
                    className="h-4 w-4 text-blue-600"
                    aria-hidden="true"
                  />
                  官方分店器械清單
                </h4>
                {officialSnapshot && (
                  <div className="text-xs leading-6 text-slate-600">
                    <p>
                      官方公開快照核對日期：
                      {dateLabel(officialSnapshot.checkedAt) || "未提供"}
                      （不是現場即時確認）
                    </p>
                    {safeLink(officialSnapshot.sourceUrl) && (
                      <a
                        className="inline-flex items-center gap-1 font-semibold text-blue-600"
                        href={safeLink(officialSnapshot.sourceUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        查看此分店官方器械來源
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                )}
                {officialMachines.length === 0 ? (
                  <p className="text-sm leading-6 text-slate-600">
                    此分店尚無可用的官方器械快照，官方設備資料未知；不套用品牌或其他分店的機器清單。可在下方補充你親自核對的器械。
                  </p>
                ) : (
                  <>
                    <p className="text-xs leading-5 text-slate-600">
                      以下為此分店官方公開的原始器械項目；未能精確對應動作的機器仍列出，但不提供替代動作。數量、型號或製造商未公開時不作推測。
                    </p>
                    <input
                      aria-label="搜尋此分店官方器械"
                      placeholder="搜尋器械、肌群分類、型號或品牌"
                      className={field}
                      value={officialSearch}
                      onChange={e => {
                        setOfficialSearch(e.target.value);
                        setOfficialLimit(20);
                      }}
                    />
                    <ul
                      aria-label="官方已公開器械"
                      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                    >
                      {filteredOfficialMachines
                        .slice(0, officialLimit)
                        .map(machine => (
                          <li
                            key={machine.id}
                            className="space-y-1 rounded-xl border border-slate-200 bg-white p-3"
                          >
                            <h5 className="text-sm font-semibold">
                              {machine.nameZh || machine.name}
                            </h5>
                            <p className="text-xs text-slate-500">
                              官方公開 · {machine.category || "分類未提供"}
                            </p>
                            <dl className="space-y-1 text-xs leading-5 text-slate-600">
                              <div>
                                <dt className="inline font-medium">製造商：</dt>
                                <dd className="inline">
                                  {machine.manufacturer || "官方未提供"}
                                </dd>
                              </div>
                              <div>
                                <dt className="inline font-medium">型號：</dt>
                                <dd className="inline">
                                  {machine.model || "官方未提供"}
                                </dd>
                              </div>
                              <div>
                                <dt className="inline font-medium">數量：</dt>
                                <dd className="inline">
                                  {machine.total ?? "官方未提供"}
                                </dd>
                              </div>
                              <div>
                                <dt className="inline font-medium">
                                  快照正常／損壞：
                                </dt>
                                <dd className="inline">
                                  {machine.normal ?? "未提供"}／
                                  {machine.damaged ?? "未提供"}（非即時）
                                </dd>
                              </div>
                            </dl>
                            {safeLink(machine.sourceUrl) && (
                              <a
                                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600"
                                href={safeLink(machine.sourceUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                官方器械項目來源
                                <ExternalLink
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                              </a>
                            )}
                            {!availableExercises.some(
                              exercise =>
                                (exercise.equipmentId === machine.id ||
                                  (typeof exercise.equipmentId === "string" &&
                                    exercise.equipmentId.startsWith(
                                      "official:"
                                    ) &&
                                    exercise.equipmentId.endsWith(
                                      `:${machine.id}`
                                    ))) &&
                                exercise.confirmationSource ===
                                  "official_inventory"
                            ) && (
                              <p className="text-xs leading-5 text-slate-500">
                                尚無精確動作對應；只列器械，不推測推薦。
                              </p>
                            )}
                          </li>
                        ))}
                    </ul>
                    {filteredOfficialMachines.length === 0 && (
                      <p className="text-xs text-slate-500">
                        沒有符合此搜尋的官方器械項目。
                      </p>
                    )}
                    {filteredOfficialMachines.length > officialLimit && (
                      <button
                        type="button"
                        className={action}
                        onClick={() => setOfficialLimit(v => v + 20)}
                      >
                        顯示更多官方器械（{officialLimit} /{" "}
                        {filteredOfficialMachines.length}）
                      </button>
                    )}
                  </>
                )}
              </section>
              <h4 className="font-bold">擁有人親自確認的器械</h4>
              {machines.length === 0 && (
                <p className="text-sm leading-6 text-slate-500">
                  尚無擁有人確認紀錄；這不會覆蓋或刪除上方官方公開清單。
                </p>
              )}
              {machines.length > 0 && (
                <ul aria-label="已確認器械" className="space-y-2">
                  {machines.map(machine => (
                    <li
                      key={machine.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 p-3"
                    >
                      <div className="flex-1">
                        <h4 className="flex items-center gap-2 text-sm font-semibold">
                          <Dumbbell
                            className="h-4 w-4 shrink-0 text-blue-600"
                            aria-hidden="true"
                          />
                          {machine.displayName}
                        </h4>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {machine.equipment} ·{" "}
                          {machine.source === "photo_confirmed"
                            ? "使用者核對相片後確認"
                            : "資料擁有人確認"}
                          {dateLabel(machine.confirmedAt)
                            ? ` · ${dateLabel(machine.confirmedAt)}`
                            : ""}
                        </p>
                        {machine.notes && (
                          <p className="mt-1 text-xs leading-5 text-slate-600">
                            {machine.notes}
                          </p>
                        )}
                        {safeLink(machine.sourceUrl) && (
                          <a
                            className="inline-flex items-center text-xs text-blue-600"
                            href={safeLink(machine.sourceUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            器械紀錄來源
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        )}
                      </div>
                      {owner && (
                        <button
                          type="button"
                          className={`${action} px-3`}
                          aria-label={`移除 ${machine.displayName}`}
                          disabled={branchBusy}
                          onClick={() => {
                            setDeleteId(machine.id);
                            setEquipmentError(null);
                          }}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {deleteId !== null && (
                <Status>
                  <p>
                    確定移除此分店的「
                    {
                      machines.find(machine => machine.id === deleteId)
                        ?.displayName
                    }
                    」確認紀錄？相關可用動作會重新計算。
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={action}
                      disabled={branchBusy}
                      onClick={() => void removeMachine()}
                    >
                      確認移除器械
                    </button>
                    <button
                      type="button"
                      className={action}
                      disabled={equipmentBusy}
                      onClick={() => setDeleteId(null)}
                    >
                      取消移除
                    </button>
                  </div>
                </Status>
              )}
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <h4 className="font-bold">按此分店已核對器械可做的動作</h4>
                <p className="text-xs leading-5 text-slate-500">
                  僅使用伺服器對官方公開或擁有人確認器械的精確動作對應結果，不表示動作最有效，也不代表適合所有人。
                </p>
                {availableExercises.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                    暫無可核對的動作對應。先確認現場器械；未知或未對應的器械不會用其他機器替代。
                  </p>
                ) : (
                  <ul
                    aria-label="此分店可用動作"
                    className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                  >
                    {availableExercises.map(exercise => {
                      const reference = getGymworkReference(
                        exercise.name,
                        exercise.equipment
                      );
                      return (
                        <li
                          key={`${exercise.equipmentId}-${exercise.name}`}
                          className="space-y-2 rounded-xl border border-slate-200 p-3"
                        >
                          <h5 className="font-semibold">
                            {exercise.nameZh || exercise.name}
                          </h5>
                          <p className="text-xs text-slate-500">
                            {exercise.name} · {exercise.equipment}
                          </p>
                          <p className="text-xs leading-5 text-blue-700">
                            器械來源：
                            {exercise.confirmationSource ===
                            "official_inventory"
                              ? "此分店官方公開快照"
                              : exercise.confirmationSource ===
                                  "photo_confirmed"
                                ? "擁有人核對相片後確認"
                                : "擁有人親自確認"}
                          </p>
                          <p className="text-xs leading-5 text-slate-600">
                            主要肌群：
                            {exercise.primaryLabels.join("、") || "未分類"}
                          </p>
                          {exercise.secondaryLabels.length > 0 && (
                            <p className="text-xs leading-5 text-slate-500">
                              輔助肌群：{exercise.secondaryLabels.join("、")}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {onOpenExercise && (
                              <button
                                type="button"
                                className={action}
                                onClick={() => openExercise(exercise)}
                              >
                                查看動作詳情
                              </button>
                            )}
                            {reference ? (
                              <a
                                href={reference.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={action}
                              >
                                Gymwork 原作頁
                                <ExternalLink
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              </a>
                            ) : (
                              <p className="text-xs leading-5 text-slate-500">
                                此動作暫無精確核對的 Gymwork 原作連結。
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="text-xs leading-5 text-slate-500">
                  Gymwork 原作在官方頁觀看；內嵌需授權，目前不複製動畫，也不使用
                  YouTube 或替代動畫。
                </p>
              </div>
            </>
          )}
          {owner && (
            <button
              type="button"
              className={action}
              aria-expanded={addOpen}
              disabled={branchBusy}
              onClick={() => {
                setAddOpen(value => !value);
                setEquipmentError(null);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              新增／確認現場器械
            </button>
          )}
          {!owner && (
            <p className="text-sm text-slate-500">
              唯讀模式：只有資料擁有人可保存器械確認。
            </p>
          )}
          {owner && addOpen && (
            <form
              aria-label="確認分店器械"
              className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4"
              onSubmit={event => {
                event.preventDefault();
                void confirmMachine();
              }}
            >
              <h4 className="font-bold">確認這個地址的現場器械</h4>
              <div
                data-equipment-evidence-import
                className="space-y-3 rounded-xl border border-slate-200 bg-white p-3"
              >
                <h5 className="flex items-center gap-2 text-sm font-semibold">
                  <Camera
                    className="h-4 w-4 text-blue-600"
                    aria-hidden="true"
                  />
                  相片協助辨識（選填）
                </h5>
                <p className="text-xs leading-5 text-slate-600">
                  相片只產生待核對草稿，不會自動保存器械。請避免拍到他人；傳送前轉為
                  JPEG，實際傳送內容須小於 3 MB。相片會送往 AI
                  辨識服務，不作分店設備證明。
                </p>
                <label
                  className={`${action} w-full cursor-pointer`}
                  htmlFor={`${id}-photo`}
                >
                  選取器械相片
                </label>
                <input
                  id={`${id}-photo`}
                  className="sr-only"
                  aria-label="匯入器械證據相片"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  disabled={branchBusy || photoBusy}
                  onChange={event => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void proposeFromPhoto(file);
                  }}
                />
                {photoName && (
                  <p className="text-xs text-slate-500">
                    已選相片：{photoName}（不保存相片檔案）
                  </p>
                )}
                {photoBusy && (
                  <Status>正在準備及辨識相片；尚未保存任何器械…</Status>
                )}
                {photoError && (
                  <Status error>
                    {photoError}
                    {preparedPhoto.current && (
                      <button
                        type="button"
                        className={`${action} mt-2`}
                        disabled={photoBusy || branchBusy}
                        onClick={() => void proposeFromPhoto()}
                      >
                        重試相片辨識
                      </button>
                    )}
                  </Status>
                )}
                {proposal && (
                  <Status>
                    <p className="font-semibold">
                      AI 建議（未確認）：{proposal.nameZh || proposal.name}
                    </p>
                    <p>
                      {proposal.name} · {proposal.equipment} · 信心：
                      {(
                        { high: "高", medium: "中", low: "低" } as Record<
                          string,
                          string
                        >
                      )[proposal.confidence] || proposal.confidence}
                    </p>
                    <p>
                      AI
                      可能認錯；請親自核對，再在下方選取相符器械。如目錄沒有精確對應，請勿選擇相近機器代替。
                    </p>
                    <button
                      type="button"
                      className={`${action} mt-2`}
                      onClick={() => {
                        setProposal(null);
                        setConfirmed(false);
                      }}
                    >
                      捨棄 AI 建議
                    </button>
                  </Status>
                )}
              </div>
              <div>
                <label
                  htmlFor={`${id}-machine`}
                  className="mb-1.5 block text-sm font-semibold"
                >
                  已核對的器械類型
                </label>
                <select
                  id={`${id}-machine`}
                  aria-label="已核對的器械類型"
                  className={field}
                  value={machineKey}
                  disabled={branchBusy || catalog.isLoading || !!catalog.error}
                  required
                  onChange={event => {
                    setMachineKey(event.target.value);
                    setConfirmed(false);
                  }}
                >
                  <option value="">選擇與現場一致的器械</option>
                  {machineOptions.map(option => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {catalog.isLoading && <Status>正在讀取已核對器械目錄…</Status>}
                {catalog.error && (
                  <Status error>
                    {catalog.error.message}
                    <button
                      type="button"
                      className={`${action} mt-2`}
                      onClick={() => void catalog.refetch()}
                    >
                      重試器械目錄
                    </button>
                  </Status>
                )}
                {!catalog.isLoading &&
                  !catalog.error &&
                  machineOptions.length === 0 && (
                    <Status>
                      器械目錄尚未提供可核對選項，不能保存推測設備。
                    </Status>
                  )}
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  選項來自伺服器已核對的精確器械目錄，不是此分店已有設備。沒有合適選項時請勿猜測。
                </p>
              </div>
              <div>
                <label
                  htmlFor={`${id}-notes`}
                  className="mb-1.5 block text-sm font-semibold"
                >
                  核對備註（選填）
                </label>
                <textarea
                  id={`${id}-notes`}
                  aria-label="器械核對備註"
                  className={`${field} min-h-20`}
                  value={notes}
                  maxLength={1000}
                  disabled={branchBusy}
                  onChange={event => {
                    setNotes(event.target.value);
                    setConfirmed(false);
                  }}
                  placeholder="例如樓層、機身標示、親自核對日期；不要填寫他人個人資料"
                />
              </div>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl bg-white p-3 text-sm leading-6">
                <input
                  aria-label="我確認此分店確實有這項器械"
                  type="checkbox"
                  className="mt-0.5"
                  checked={confirmed}
                  disabled={branchBusy || photoBusy}
                  onChange={event => setConfirmed(event.target.checked)}
                />
                <span>
                  我已親自核對「{selected.name}
                  」這個地址確實有此器械。保存來源為「資料擁有人確認」，不是官方或
                  AI 自動認證。
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className={primaryAction}
                  disabled={
                    !machineKey ||
                    !confirmed ||
                    branchBusy ||
                    photoBusy ||
                    !!catalog.error ||
                    catalog.isLoading
                  }
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {equipmentBusy ? "保存中…" : "確認並保存器械"}
                </button>
                <button
                  type="button"
                  className={action}
                  disabled={equipmentBusy}
                  onClick={() => {
                    resetEquipmentDraft();
                    setAddOpen(false);
                  }}
                >
                  取消新增器械
                </button>
              </div>
            </form>
          )}
          {equipmentError && (
            <Status error>
              {equipmentError}{" "}
              確認資料沒有自動補存；請核對後按保存／移除按鈕重試。
            </Status>
          )}
        </section>
      )}
    </section>
  );
}
