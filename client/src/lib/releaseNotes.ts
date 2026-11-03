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
    version: "3.15.9",
    status: "released",
    title: "iPhone 相片匯入及統一 InBody 入口修復",
    summary: "修正舊照片匯入沒有壓縮而超過 Vercel 限制，Safari 只顯示 pattern 錯誤的問題；身體成份的匯入與影相報告統一為可選範本的入口。",
    changes: {
      added: ["相片匯入增加原圖全框 JPEG 壓縮、後置相機、相簿及不用重新上載的辨識重試；身體成份頁內顯示版本，方便在 Life Hub 嵌入畫面核對。"],
      removed: ["移除一般照片直接傳送大型原檔 base64 的行為，以及把私有相對圖片網址直接交給外部視覺模型的錯誤。"],
      improved: ["按匯入預設開啟 InBody 紙本範本，同時保留一般截圖、CSV、手動及表格輸入；缺少報告日期時必須核對，零值不再被隱藏。", "辨識前驗證圖片位元組及容量；413 或非 JSON 回應顯示可操作中文指引，不再只回傳 Safari pattern 訊息。"],
      revised: ["一般照片及表單內截圖入口沿用整頁壓縮；辨識仍只作核對預覽，確認前不新增健康紀錄。", "保留現有 Supabase 保存、歷史紀錄及 InBody 相片去重，不更改跑步、地圖或 FIT 分析資料。"],
    },
  },
  {
    version: "3.15.8",
    status: "released",
    title: "InBody 影相範本與 FIT 連續數據分析",
    summary: "身體成份加入 InBody 紙本報告相機／相簿辨識及核對後保存；跑步分析和預測亦使用已保存的 FIT 連續樣本，不再只看活動摘要。",
    changes: {
      added: ["新增 InBody 紙本範本，辨識主要身體數據、水分、除脂體重、腰臀比及五部位除脂／脂肪資料，確認後一次保存至現有 Life-OS Supabase。", "新增歷史報告明細、來源相片追溯，以及連續配速、心率、步頻、功率與前後半表現衍生特徵。"],
      removed: ["移除跑步 AI 只傳最近 30 次活動摘要的限制；完整歷史以分頁計算特徵，提示容量不足會明示逐次特徵省略及保留全歷史月度統計。"],
      improved: ["相機照片在裝置保留整頁壓縮，避免大型 iPhone 相片超過上載限制；保存失敗保留相片及核對結果，可直接重試。", "跑步 AI、賽事分析及能量實驗室接入合資格連續數據；低覆蓋或欠缺連續樣本時維持摘要或參考值，並顯示校準依據。"],
      revised: ["紙本日期及時間採報告所列香港時間，缺日期必須核對，不代入今天；缺失值不補猜。", "區分 SMM／FFM、BMR／建議熱量、WHR／內臟脂肪，保留正負號及零；相同相片保存重試不重複新增或覆寫原有手動資料。", "連續分析採時間加權、排除停頓及長缺口，明示量測、衍生特徵與模型預測，不能把估算 VO₂ 或乳酸當作實測。"],
    },
  },
  {
    version: "3.15.7",
    status: "released",
    title: "Garmin 地圖閃爍與重複載入修復",
    summary: "修正 Garmin 簡報因賽事倒數每秒更新而反覆初始化地圖；相同路線會保留地圖、縮放及拖動位置。",
    changes: {
      added: ["新增一秒計時父頁、連續重渲染、失敗狀態鎖定及真實路線更新的回歸測試。"],
      removed: ["移除相同原始路線因 callback 參照改變而重新建立整張地圖的行為。"],
      improved: ["Garmin 簡報只在原始逐秒資料真正改變時重新整理樣本；賽事倒數仍正常更新。", "地圖初始化與路線覆蓋物更新分開，保留底圖及互動狀態。"],
      revised: ["地圖失敗後會維持備援，不因頁面刷新而自動切回載入；只有手動重試才重新初始化。", "不改動既有跑步紀錄、GPS、日期或原始檔。"],
    },
  },
  {
    version: "3.15.6",
    status: "released",
    title: "Garmin 路線地圖空白修復",
    summary: "修正外部網域地圖服務載入失敗時只顯示空白框的問題；已保存的 GPS 可直接顯示在街道備援地圖，不用重新上載原始檔。",
    changes: {
      added: ["新增原生 OpenStreetMap 備援街道底圖，疊加同一筆原始 GPS 路線與起終點，支援拖動、縮放及全程定位。"],
      removed: ["移除地圖載入失敗後靜默留下空白區域的行為。"],
      improved: ["Google 地圖保留優先載入；失敗時自動切換備援並提供重試，不影響海拔或逐秒圖表。", "底圖失敗也會明確提示並保留 GPS 線條；只載入可見圖磚並保留來源標示。"],
      revised: ["新增 SDK 逾時、失敗腳本清理、重新嘗試及路線覆蓋物清理，避免舊請求阻塞。", "只修正顯示；既有跑步紀錄、GPS 座標及原始檔沒有變更。"],
    },
  },
  {
    version: "3.15.5",
    status: "released",
    title: "Garmin 原始檔直接保存到跑步紀錄",
    summary: "上載 FIT／CSV／GPX／TCX 後自動解析並保存原始檔與圖表資料，不再需要先套用再儲存。",
    changes: {
      added: ["原始檔上載後直接保存逐秒曲線、GPS 路線、海拔與坡度分析所需數據，並顯示紀錄編號。", "以檔案雜湊識別重複上載；同檔重試不會重複新增。"],
      removed: ["移除原始檔匯入必須先按「套用到這次跑步」再按「儲存」的額外步驟。"],
      improved: ["編輯過往紀錄時直接附加原始數據，保留既有摘要、跑鞋、天氣及備註。", "未選紀錄時按香港日期、距離及時間配對唯一歷史紀錄；配對不明確時提示先編輯指定紀錄。"],
      revised: ["保存失敗可直接重試儲存而不必再次上載；已保存後手動補填只更新同一紀錄。", "沒有曲線樣本的有效活動只保存摘要，不產生虛構圖表。", "修正 FIT 步幅毫米轉公尺、垂直振幅毫米轉厘米及跑步步頻單位；缺失日期不再代入今天。"],
    },
  },
  {
    version: "3.15.4",
    status: "released",
    title: "Garmin 原始檔匯入可靠性",
    summary: "改善舊有 Garmin FIT、CSV、GPX、TCX 活動檔的分段上載與失敗復原，並保留先核對、後儲存的流程。",
    changes: {
      added: ["每個 2MB 原始檔分段會在短暫網絡問題時自動重試最多三次。", "失敗後保留已選檔案，提供「再次嘗試」而不需要重新選檔。", "新增實際含雜湊的儲存 key、分段合併與 GPX 解析回歸／端到端驗證。"],
      removed: ["無。"],
      improved: ["明確辨識 25MB 上限、ZIP 壓縮檔、格式不支援、損壞活動檔及臨時網絡問題。", "上載失敗提示改為可行的 Garmin Connect 匯出與重試指引。"],
      revised: ["活動資料仍必須由使用者核對後按「套用到這次跑步」及「儲存」才會新增跑步紀錄。"],
    },
  },
  {
    version: "3.15.3",
    status: "released",
    title: "健康表格輸入可靠性修復",
    summary: "身體成份、心跳及睡眠的 Excel 式批量輸入現已直接儲存至 Supabase，不再因 Google Sheets 設定影響新增。",
    changes: {
      added: ["新增逐行獨立 Supabase 批量儲存器；個別列失敗時，其餘有效列仍會繼續保存。", "新增三個批量 API 的實際寫入、讀取與清理端到端驗證。"],
      removed: ["移除身體成份、心跳及睡眠批量輸入對 Google Sheets 的前置同步要求。"],
      improved: ["保留 Excel／Google Sheets 複製貼上的表格體驗、香港日期驗證、逐行結果、CSV 匯入及圖片匯入入口。"],
      revised: ["提交結果與頁面說明統一標示為直接 Supabase 儲存，不再顯示外部試算表同步待處理訊息。"],
    },
  },
  {
    version: "3.15.2",
    status: "released",
    title: "部署更新自動復原",
    summary: "已發布：避免瀏覽器保留舊版頁面時，因 Vercel 更新替換延遲載入檔案而停留在錯誤畫面。",
    changes: {
      added: ["新增 Vite preload 與動態模組載入失敗的偵測及單次安全自動重新載入。"],
      removed: ["錯誤頁不再顯示包含資產網址的技術堆疊內容。"],
      improved: ["偵測到新版本部署時，使用者無須手動清除快取；系統會自行刷新一次以取得最新頁面。"],
      revised: ["如網絡中斷或嚴格私隱設定令自動復原無法安全執行，畫面會顯示繁體中文說明及手動重新載入按鈕，並避免重載循環。"],
    },
  },
  {
    version: "3.15.1",
    status: "released",
    title: "跑步資料顯示修復",
    summary: "已發布：修正既有跑步資料表的讀取條件，恢復跑步歷史、Garmin 簡報及能量實驗室的已儲存資料。",
    changes: {
      added: ["新增跑步資料表 schema 回歸測試，防止再次使用不存在的欄位篩選舊有紀錄。"],
      removed: ["移除 running_logs 讀取程序中不存在的 user_id 過濾條件。"],
      improved: ["跑步紀錄分頁、Garmin 健康數據簡報及能量實驗室會重新使用全部 421 筆已儲存跑步歷史。"],
      revised: ["身體成份、睡眠、心跳、飲食、健身、步數及血壓仍維持既有 user_id 資料範圍；沒有刪除或遷移任何健康紀錄。"],
    },
  },
  {
    version: "3.15.0",
    status: "released",
    title: "Garmin 健康數據簡報",
    summary: "已發布：把已儲存的 Garmin 跑步、心率、睡眠及身體成份資料整合為可互動檢視的數據簡報。",
    changes: {
      added: ["跑步頁新增 Garmin 簡報工作區，集中訓練負荷、心率、恢復、跑姿與資料覆蓋率。", "逐秒 Garmin 曲線新增步頻及功率切換；GPS 路線和坡度分析保持在同一筆原始跑步詳情。"],
      removed: ["無。"],
      improved: ["簡報只顯示實際已儲存的資料；缺少原始檔、GPS、功率、睡眠或身體成份時會清楚標示。"],
      revised: ["健康與跑步資料一律按香港時間標示；心率區間採用已儲存的 Zone 1–5 分鐘數，而非由平均心率推算。"],
    },
  },
  {
    version: "3.14.9",
    status: "released",
    title: "跑步歷史分頁與情境相容校準",
    summary: "已發布：讓大量跑步歷史可逐頁查看，並讓能量系統實驗室只以相符項目的跑步資料校準。",
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
    feature: "InBody 紙本報告與影相輸入",
    status: "released",
    summary: "從相機或相簿辨識完整 InBody 紙本報告，核對後一次保存實測值、分部數據與相片來源至現有 Life-OS Supabase。",
    lastRevisedVersion: "3.15.8",
    lastRevisedDateHK: "2026年11月3日（香港）",
    history: [
      { version: "3.15.8", dateHK: "2026年11月3日", description: "新增 InBody 範本、手機影相／選圖、完整核對、歷史明細及相片重試去重；保留一般手動、截圖及表格輸入。" },
    ],
  },
  {
    feature: "跑步 AI 分析與 FIT 連續證據",
    status: "released",
    summary: "分析完整歷史與可用 FIT 連續樣本，清楚區分實測摘要、時間加權衍生特徵及不確定的模型預測。",
    lastRevisedVersion: "3.15.8",
    lastRevisedDateHK: "2026年11月3日（香港）",
    history: [
      { version: "3.15.8", dateHK: "2026年11月3日", description: "跑步 AI、賽事分析及預測加入全歷史分頁特徵、前後半表現、心率漂移及持續觀測配速；揭示覆蓋率、缺口與提示容量限制。" },
    ],
  },
  {
    feature: "Garmin 健康數據簡報",
    status: "released",
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
    status: "released",
    summary: "依跑步項目、天氣及相容歷史資料，提供教學用途的能量系統與恢復估算。",
    lastRevisedVersion: "3.15.8",
    lastRevisedDateHK: "2026年11月3日（香港）",
    history: [
      { version: "3.14.0", dateHK: "2026年10月31日", description: "建立互動式跑步能量系統、天氣因素及供能／恢復曲線。" },
      { version: "3.14.2", dateHK: "2026年11月1日", description: "加入個人身體成份及跑步歷史個人化校準。" },
      { version: "3.14.7", dateHK: "2026年11月1日", description: "改為自動掃描完整歷史跑步資料。" },
      { version: "3.14.9", dateHK: "2026年11月1日", description: "按項目選取類型、路線與距離相容資料，排除不適合的越野或長跑樣本。" },
      { version: "3.15.8", dateHK: "2026年11月3日", description: "相容且連續覆蓋達標的 FIT／原始樣本以時間加權觀測配速校準；保留摘要後備並顯示實際選用數量與覆蓋率。" },
    ],
  },
  {
    feature: "跑步紀錄、GPS 路線與歷史清單",
    status: "released",
    summary: "保存跑步、賽事、路線類型、GPS、坡度與時間序列，並可瀏覽完整歷史。",
    lastRevisedVersion: "3.15.7",
    lastRevisedDateHK: "2026年11月3日（香港）",
    history: [
      { version: "3.14.2", dateHK: "2026年11月1日", description: "加入路線類型、跑步／賽事天氣及歷史回填。" },
      { version: "3.14.6", dateHK: "2026年11月1日", description: "加入 GPX 路線地圖、海拔剖面和坡度分段分析。" },
      { version: "3.14.9", dateHK: "2026年11月1日", description: "加入伺服器端分頁，讓所有歷史紀錄均可逐頁查看。" },
      { version: "3.15.6", dateHK: "2026年11月3日", description: "修復地圖空白，加入 SDK 載入復原及可拖動縮放的 GPS 街道備援地圖，不改動既有活動資料。" },
      { version: "3.15.7", dateHK: "2026年11月3日", description: "修正每秒倒數引致的地圖閃爍，穩定樣本參照與地圖生命週期，保留縮放及拖動狀態。" },
    ],
  },
  {
    feature: "Garmin 匯入與逐秒資料",
    status: "released",
    summary: "從連續截圖或原始活動檔核對後匯入，保留可用的逐秒表現、GPS 與海拔資料。",
    lastRevisedVersion: "3.15.5",
    lastRevisedDateHK: "2026年11月3日（香港）",
    history: [
      { version: "3.14.2", dateHK: "2026年11月1日", description: "新增 Garmin 多截圖合併匯入及核對流程。" },
      { version: "3.14.5", dateHK: "2026年11月1日", description: "改善多圖分批可靠性並支援 FIT、CSV、GPX、TCX 逐秒資料。" },
      { version: "3.14.6", dateHK: "2026年11月1日", description: "保存 GPS 座標並加入路線與坡度視覺化。" },
      { version: "3.15.4", dateHK: "2026年11月2日", description: "加入每段自動重試、同檔再次嘗試及 ZIP／格式／網絡失敗指引，並完成正式站分段 GPX 實測。" },
      { version: "3.15.5", dateHK: "2026年11月3日", description: "原始檔成功上載後直接保存到跑步紀錄，保留手動欄位並防止重複新增。" },
    ],
  },
  {
    feature: "健康表格式輸入與 Google Sheets",
    status: "released",
    summary: "以 Excel 式貼上與逐行驗證加快健康記錄；身體成份、睡眠與心跳直接保存 Supabase，不再依賴 Google Sheets 是否可用。",
    lastRevisedVersion: "3.15.3",
    lastRevisedDateHK: "2026年11月2日（香港）",
    history: [
      { version: "3.14.7", dateHK: "2026年11月1日", description: "身體成份、睡眠、心跳、步數／樓梯及血壓加入多列貼上、香港日期驗證及結果回報。" },
      { version: "3.14.7", dateHK: "2026年11月1日", description: "身體成份、睡眠與心跳採 Google Sheets 優先同步，並保留資料庫鏡像供圖表使用。" },
      { version: "3.15.3", dateHK: "2026年11月2日", description: "身體成份、睡眠與心跳表格改為直接寫入 Supabase，解除 Sheets 故障對保存的阻擋；歷史資料保留。" },
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
