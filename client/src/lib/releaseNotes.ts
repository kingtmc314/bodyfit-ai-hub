export type ReleaseNoteStatus = "released" | "in-progress";

export type ReleaseChangeGroups = {
  added: readonly string[];
  removed: readonly string[];
  improved: readonly string[];
  revised: readonly string[];
};

export type ReleaseNote = {
  version: string;
  status: ReleaseNoteStatus;
  title: string;
  summary: string;
  changes: ReleaseChangeGroups;
};

export type FeatureHistoryEntry = {
  version: string;
  dateHK: string;
  description: string;
};

export type FeatureHistory = {
  feature: string;
  status: ReleaseNoteStatus;
  summary: string;
  lastRevisedVersion: string;
  lastRevisedDateHK: string;
  history: readonly FeatureHistoryEntry[];
};

/**
 * Customer-facing release notes. Every release is categorised so users can scan
 * what was added, removed, improved or revised without inferring it from prose.
 */
export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    version: "3.15.0",
    status: "in-progress",
    title: "Garmin 健康數據簡報",
    summary: "進行中：把已儲存的 Garmin 跑步、心率、睡眠及身體成份資料整合為可互動檢視的數據簡報。",
    changes: {
      added: ["跑步頁新增 Garmin 簡報工作區，集中訓練負荷、心率、恢復、跑姿與資料覆蓋率。", "逐秒 Garmin 曲線新增步頻及功率切換；GPS 路線和坡度分析保持在同一筆原始跑步詳情。"],
      removed: ["無。"],
      improved: ["簡報只顯示實際已儲存的資料；缺少原始檔、GPS、功率、睡眠或身體成份時會清楚標示。"],
      revised: ["健康與跑步資料一律按香港時間標示；心率區間採用已儲存的 Zone 1–5 分鐘數，而非由平均心率推算。"],
    },
  },
  {
    version: "3.14.9",
    status: "in-progress",
    title: "跑步歷史分頁與情境相容校準",
    summary: "進行中：讓大量跑步歷史可逐頁查看，並讓能量系統實驗室只以相符項目的跑步資料校準。",
    changes: {
      added: ["跑步紀錄伺服器端分頁，提供總筆數、頁碼、上一頁及下一頁。", "能量實驗室顯示自動選取規則、相容樣本、排除筆數及保守回退原因。"],
      removed: ["無。"],
      improved: ["實驗室會掃描完整歷史後，自動挑選類型、路線與距離相符的跑步數據。"],
      revised: ["100–400m 衝刺不再以越野或長距離慢跑作為校準樣本；沒有精確相符紀錄時會清楚說明回退策略。"],
    },
  },
  {
    version: "3.14.8",
    status: "released",
    title: "記錄與工具導覽精簡",
    summary: "已發布：讓側欄更聚焦於日常健康追蹤，同時完整保留現有健康紀錄。",
    changes: {
      added: ["無新增功能。"],
      removed: ["從側欄及手機更多選單移除「進度相片」與全域「匯入數據」入口，對應頁面路由亦不再開放。"],
      improved: ["記錄與工具的導覽更精簡，較常用的健康追蹤項目更容易找到。"],
      revised: ["保留身體、睡眠、心跳、步數、血壓、飲食、健身與跑步的全部既有健康紀錄，以及各頁原有截圖、檔案、Excel／Google Sheets 輸入功能。"],
    },
  },
  {
    version: "3.14.7",
    status: "released",
    title: "Excel 式健康數據輸入與全歷史跑步分析",
    summary: "已發布：以可直接貼上的表格加快日常健康紀錄，並讓跑步實驗室自動使用完整歷史資料。",
    changes: {
      added: ["步數及樓梯、心跳、血壓、睡眠及身體成份頁面新增可貼上 Excel／Google Sheets 多列資料的表格輸入。", "身體成份、睡眠及心跳表格式紀錄支援 Google Sheets 優先同步。"],
      removed: ["無。"],
      improved: ["逐行驗證香港日期／時間、數值範圍及必填資料，並回報新增、更新、同步或失敗結果。"],
      revised: ["跑步能量系統實驗室改為分析全部已儲存跑步資料，不再限制最近 24 筆或 180 天。"],
    },
  },
  {
    version: "3.14.6",
    status: "released",
    title: "GPX 路線地圖與坡度分段分析",
    summary: "已發布：將 Garmin GPS 路線、海拔剖面與每公里坡度分段整合至跑步資料核對及紀錄詳情。",
    changes: {
      added: ["在 Garmin 逐秒曲線下方加入原始路線地圖、海拔剖面、總爬升／下降、坡度分布及每公里分析。"],
      removed: ["無。"],
      improved: ["FIT、CSV、GPX 與 TCX 原始檔會保留可用 GPS 經緯度；缺少 GPS 或海拔時顯示清晰提示。"],
      revised: ["修復手機「更多」抽屜捲動範圍，現可滑到所有次要健康頁面和版本歷程。"],
    },
  },
  {
    version: "3.14.5",
    status: "released",
    title: "Garmin 多截圖可靠性與逐秒曲線",
    summary: "已發布：更穩定地合併 Garmin 截圖，並可互動檢視原始逐秒跑步資料。",
    changes: {
      added: ["支援 Garmin FIT、CSV、GPX 及 TCX 原始檔，以及互動配速、心率及海拔曲線。"],
      removed: ["無。"],
      improved: ["以每 5 張自動分批分析 Garmin 連續截圖，並使用安全直接視覺資料，降低大量圖片失敗機會。"],
      revised: ["配速曲線採反向 Y 軸；時間與提示一律使用香港時區，長跑資料則智能均勻採樣。"],
    },
  },
  {
    version: "3.14.4",
    status: "released",
    title: "資料匯入、歷史比較與行動導覽",
    summary: "已發布：讓 Garmin 原始資料、長期健身比較與手機操作更容易追蹤。",
    changes: {
      added: ["新增 Garmin FIT／CSV 原始檔匯入、香港年月健身歷史比較、手機固定底部導覽及版本歷程。"],
      removed: ["無。"],
      improved: ["Garmin 多截圖分析加入安全網址與回應格式容錯，健身歷史可比較同等期間或上個月訓練量。"],
      revised: ["手機將儀表板、飲食、健身及跑步置於固定底部主導覽，其他健康項目則集中於更多選單。"],
    },
  },
  {
    version: "3.14.3",
    status: "released",
    title: "介面可讀性與歷史訓練紀錄",
    summary: "已發布：提升操作介面的清晰度，並確保完整顯示過往訓練紀錄。",
    changes: {
      added: ["無新增功能。"],
      removed: ["移除健身頁用戶端 90 天顯示限制。"],
      improved: ["強化淺色模式的表面、邊框、標籤、控制項及鍵盤焦點對比。"],
      revised: ["改善側欄選取狀態，並保留暖橙與青綠的 BodyFit 視覺風格及深色模式支援。"],
    },
  },
  {
    version: "3.14.2",
    status: "released",
    title: "跑步天氣與 Garmin 匯入",
    summary: "已發布：讓跑步紀錄保留更完整的環境、配速與訓練細節。",
    changes: {
      added: ["跑步紀錄與賽事加入香港天氣資訊、路線／天氣回填預覽及 Garmin 多截圖合併匯入。"],
      removed: ["無。"],
      improved: ["擴充跑步資料同步、能量實驗室個人化、跑鞋效能與鞋櫃篩選工具。"],
      revised: ["跑步資料結構可保存更完整的環境、配速與訓練細節。"],
    },
  },
  {
    version: "3.14.1",
    status: "released",
    title: "跑鞋效能與訓練規劃",
    summary: "已發布：改善跑鞋分析，並加強健身課程與跑步情境規劃。",
    changes: {
      added: ["新增推、拉、腿與全身訓練範本、一鍵漸進超負荷建議及可儲存的跑步天氣情境比較。"],
      removed: ["無。"],
      improved: ["跑鞋效能可按距離區間及路線類型篩選。"],
      revised: ["健身訓練與跑步情境的規劃流程更貼近日常運動決策。"],
    },
  },
  {
    version: "3.14.0",
    status: "released",
    title: "核心健康與訓練體驗更新",
    summary: "已發布：聚焦飲食、健身與跑步追蹤，同時保留既有健康紀錄。",
    changes: {
      added: ["飲食相片優先記錄流程、健身下一組預填與休息計時、跑鞋效能圖及互動能量實驗室。"],
      removed: ["無。"],
      improved: ["飲食、健身及跑步的記錄和分析流程更連貫。"],
      revised: ["核心產品重心調整為飲食、健身與跑步，並保留其他既有健康紀錄。"],
    },
  },
];

/** A feature-first view; dates are Hong Kong calendar dates. */
export const FEATURE_HISTORY: readonly FeatureHistory[] = [
  {
    feature: "Garmin 健康數據簡報",
    status: "in-progress",
    summary: "以已儲存的跑步、Garmin 原始檔、心跳、睡眠及身體成份資料，提供可追溯的訓練與恢復資訊圖表。",
    lastRevisedVersion: "3.15.0",
    lastRevisedDateHK: "2026年11月1日（香港）",
    history: [
      { version: "3.14.5", dateHK: "2026年11月1日", description: "建立 Garmin 原始檔逐秒配速、心率及海拔曲線。" },
      { version: "3.14.6", dateHK: "2026年11月1日", description: "加入 GPS 路線、海拔剖面及坡度分段分析。" },
      { version: "3.15.0", dateHK: "2026年11月1日", description: "新增跑步健康數據簡報、資料覆蓋率，以及步頻與功率逐秒曲線。" },
    ],
  },
  {
    feature: "跑步能量系統互動實驗室",
    status: "in-progress",
    summary: "依跑步項目、天氣及相容歷史資料，提供教學用途的能量系統與恢復估算。",
    lastRevisedVersion: "3.14.9",
    lastRevisedDateHK: "2026年11月1日（香港）",
    history: [
      { version: "3.14.0", dateHK: "2026年10月31日", description: "建立互動式跑步能量系統、天氣因素及供能／恢復曲線。" },
      { version: "3.14.2", dateHK: "2026年11月1日", description: "加入個人身體成份及跑步歷史個人化校準。" },
      { version: "3.14.7", dateHK: "2026年11月1日", description: "改為自動掃描完整歷史跑步資料。" },
      { version: "3.14.9", dateHK: "2026年11月1日", description: "按項目選取類型、路線與距離相容資料，排除不適合的越野或長跑樣本。" },
    ],
  },
  {
    feature: "跑步紀錄、GPS 路線與歷史清單",
    status: "in-progress",
    summary: "保存跑步、賽事、路線類型、GPS、坡度與時間序列，並可瀏覽完整歷史。",
    lastRevisedVersion: "3.14.9",
    lastRevisedDateHK: "2026年11月1日（香港）",
    history: [
      { version: "3.14.2", dateHK: "2026年11月1日", description: "加入路線類型、跑步／賽事天氣及歷史回填。" },
      { version: "3.14.6", dateHK: "2026年11月1日", description: "加入 GPX 路線地圖、海拔剖面和坡度分段分析。" },
      { version: "3.14.9", dateHK: "2026年11月1日", description: "加入伺服器端分頁，讓所有歷史紀錄均可逐頁查看。" },
    ],
  },
  {
    feature: "Garmin 匯入與逐秒資料",
    status: "released",
    summary: "從連續截圖或原始活動檔核對後匯入，保留可用的逐秒表現、GPS 與海拔資料。",
    lastRevisedVersion: "3.14.6",
    lastRevisedDateHK: "2026年11月1日（香港）",
    history: [
      { version: "3.14.2", dateHK: "2026年11月1日", description: "新增 Garmin 多截圖合併匯入及核對流程。" },
      { version: "3.14.5", dateHK: "2026年11月1日", description: "改善多圖分批可靠性並支援 FIT、CSV、GPX、TCX 逐秒資料。" },
      { version: "3.14.6", dateHK: "2026年11月1日", description: "保存 GPS 座標並加入路線與坡度視覺化。" },
    ],
  },
  {
    feature: "健康表格式輸入與 Google Sheets",
    status: "released",
    summary: "以 Excel 式貼上與逐行驗證加快健康記錄，並維持重要資料的 Sheets 優先同步。",
    lastRevisedVersion: "3.14.7",
    lastRevisedDateHK: "2026年11月1日（香港）",
    history: [
      { version: "3.14.7", dateHK: "2026年11月1日", description: "身體成份、睡眠、心跳、步數／樓梯及血壓加入多列貼上、香港日期驗證及結果回報。" },
      { version: "3.14.7", dateHK: "2026年11月1日", description: "身體成份、睡眠與心跳採 Google Sheets 優先同步，並保留資料庫鏡像供圖表使用。" },
    ],
  },
  {
    feature: "健身記錄與漸進訓練",
    status: "released",
    summary: "以訓練範本、下一組預填與休息計時，輔助一致的健身紀錄。",
    lastRevisedVersion: "3.14.4",
    lastRevisedDateHK: "2026年11月1日（香港）",
    history: [
      { version: "3.14.1", dateHK: "2026年11月1日", description: "加入推、拉、腿、全身訓練範本與自動漸進超負荷建議。" },
      { version: "3.14.3", dateHK: "2026年11月1日", description: "移除 90 天列表限制，恢復完整歷史訓練紀錄。" },
      { version: "3.14.4", dateHK: "2026年11月1日", description: "加入香港年月篩選及不同期間的訓練量比較。" },
    ],
  },
  {
    feature: "行動導覽、版本歷程與可讀性",
    status: "in-progress",
    summary: "讓手機操作、色彩對比與產品變更資訊保持清楚、可追溯。",
    lastRevisedVersion: "3.14.9",
    lastRevisedDateHK: "2026年11月1日（香港）",
    history: [
      { version: "3.14.3", dateHK: "2026年11月1日", description: "提升淺色主題的文字、面板及操作元件對比。" },
      { version: "3.14.4", dateHK: "2026年11月1日", description: "加入固定底部主導覽和版本歷程。" },
      { version: "3.14.6", dateHK: "2026年11月1日", description: "修復更多選單捲動，確保可到達全部次要頁面。" },
      { version: "3.14.8", dateHK: "2026年11月1日", description: "移除進度相片與全域匯入數據入口，精簡記錄與工具導覽。" },
      { version: "3.14.9", dateHK: "2026年11月1日", description: "版本更新改以新增、刪除、優化、修訂分類，並加入功能歷程分頁。" },
    ],
  },
];
