export type ReleaseNoteStatus = "released" | "in-progress";

export type ReleaseNote = {
  version: string;
  status: ReleaseNoteStatus;
  title: string;
  summary: string;
  highlights: readonly string[];
};

/**
 * Customer-facing release notes. Keep in-progress entries limited to changes
 * currently present in the product; published versions should contain only
 * confirmed release highlights.
 */
export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    version: "3.14.8",
    status: "released",
    title: "記錄與工具導覽精簡",
    summary: "已發布：移除記錄與工具中的進度相片與全域匯入數據入口，讓側欄更聚焦健康追蹤。",
    highlights: [
      "「進度相片」與「匯入數據」已從側欄及手機更多選單移除，對應頁面路由亦不再開放。",
      "既有的身體、睡眠、心跳、步數、血壓、飲食、健身與跑步紀錄均完整保留，並未刪除任何健康資料。",
      "各健康頁現有的截圖、檔案及 Excel／Google Sheets 表格式輸入入口仍然可用。",
    ],
  },
  {
    version: "3.14.7",
    status: "released",
    title: "Excel 式健康數據輸入與全歷史跑步分析",
    summary: "已發布：以可直接貼上的表格加快日常健康紀錄，並讓跑步能量實驗室自動使用所有歷史跑步資料校準。",
    highlights: [
      "步數及樓梯、心跳、血壓、睡眠及身體成份頁面新增「表格輸入」：可從 Excel 或 Google Sheets 貼上多列資料，支援含標題的 TSV／CSV 與任意儲存格貼上。",
      "每一行會先驗證香港日期／時間、數值範圍與必填項目，再回報新增、更新、同步或失敗的逐行結果；重貼同一天的日常紀錄會安全更新，而不會重複建立。",
      "身體成份、睡眠與心跳的表格式紀錄會先寫入對應 Google Sheets，才鏡像同步至應用程式，確保試算表仍是該三類資料的來源。",
      "跑步能量系統實驗室不再限制最近 24 筆或 180 天：現會自動分析全部已儲存跑步的配速、心率、距離與跑步類型分布；同時採用更深色、高對比的科學分析介面。",
    ],
  },
  {
    version: "3.14.6",
    status: "released",
    title: "GPX 路線地圖與坡度分段分析",
    summary: "已發布：將 Garmin GPS 路線、海拔剖面與每公里坡度分段整合至跑步資料核對及紀錄詳情。",
    highlights: [
      "FIT、CSV、GPX 與 TCX 原始跑步檔會保留可用的 GPS 經緯度，並在 Garmin 逐秒曲線下方顯示原始路線地圖。",
      "新增海拔剖面、總爬升／下降、最大上坡與下坡、坡度分布，以及約每公里的高度變化與平均坡度分段。",
      "沒有 GPS 或海拔的活動會顯示清晰提示，不會以道路導航資料猜測或取代已上載的原始記錄。",
      "修復手機「更多」抽屜的捲動範圍；現可直接滑到所有次要健康頁面和版本歷程。",
    ],
  },
  {
    version: "3.14.5",
    status: "released",
    title: "Garmin 多截圖可靠性與逐秒曲線",
    summary: "已發布：更穩定地合併 Garmin 截圖，並可互動檢視原始逐秒跑步資料。",
    highlights: [
      "Garmin 連續截圖改為每 5 張自動分批分析，再以不覆蓋已讀取數值的方式合併，減少大量截圖造成的分析失敗。",
      "圖片改為安全的直接視覺資料輸入，避免臨時簽名網址過期或格式限制；仍維持先核對、後儲存的流程。",
      "支援 Garmin FIT、CSV、GPX 及 TCX 原始檔，並以安全直傳支援最大 25MB 的檔案；其逐秒資料可於跑步紀錄中開啟互動配速、心率及海拔曲線。",
      "配速曲線採反向 Y 軸（越高越快），時間與提示一律以香港時區顯示；長跑資料會智慧採樣以保持流暢。",
    ],
  },
  {
    version: "3.14.4",
    status: "released",
    title: "資料匯入、歷史比較與行動導覽",
    summary: "已發布：讓 Garmin 原始資料、長期健身比較與手機操作更容易追蹤。",
    highlights: [
      "修復 Garmin 多截圖分析的安全圖片網址與回應格式容錯，保留先核對再儲存的流程。",
      "新增 Garmin FIT／CSV 原始檔匯入，保存可用的逐秒配速、心率、步頻、功率與海拔樣本。",
      "健身歷史新增香港年月篩選，以及與上一個同等期間或上個月的訓練量比較。",
      "行動裝置新增固定底部主導覽，快速前往儀表板、飲食、健身與跑步。",
      "保留「更多」選單與原有側欄抽屜，集中存取其他健康紀錄及工具。",
      "新增本頁版本歷程，讓你隨時了解產品功能更新。",
    ],
  },
  {
    version: "3.14.3",
    status: "released",
    title: "介面可讀性與歷史訓練紀錄",
    summary: "已發布：提升操作介面的清晰度，並確保完整顯示過往訓練紀錄。",
    highlights: [
      "強化淺色模式的表面、邊框、標籤、控制項與鍵盤焦點對比。",
      "改善側欄選取狀態，並維持暖橙與青綠的 BodyFit 視覺風格及深色模式支援。",
      "移除用戶端 90 天顯示限制，讓完整的歷史健身課程與組數可在訓練歷史中查看。",
    ],
  },
  {
    version: "3.14.2",
    status: "released",
    title: "跑步天氣與 Garmin 匯入",
    summary: "已發布：讓跑步紀錄保留更完整的環境、配速與訓練細節。",
    highlights: [
      "跑步紀錄與賽事支援香港天氣資訊及路線／天氣回填預覽。",
      "加入 Garmin 多張截圖匯入，可合併總覽、統計、分段與圖表後再確認。",
      "擴充跑步資料同步、能量實驗室個人化，以及跑鞋效能與鞋櫃篩選工具。",
    ],
  },
  {
    version: "3.14.1",
    status: "released",
    title: "跑鞋效能與訓練規劃",
    summary: "已發布：改善跑鞋分析，並加強健身課程與跑步情境規劃。",
    highlights: [
      "跑鞋效能可按距離區間及路線類型篩選，並支援完整匯出同步。",
      "新增推、拉、腿與全身訓練範本，以及一鍵漸進超負荷建議。",
      "跑步能量實驗室可儲存具名的香港天氣情境比較快照。",
    ],
  },
  {
    version: "3.14.0",
    status: "released",
    title: "核心健康與訓練體驗更新",
    summary: "已發布：聚焦飲食、健身與跑步追蹤，同時保留既有健康紀錄。",
    highlights: [
      "飲食改為相片優先的擷取、覆核與記錄流程，方便由餐點相片開始。",
      "健身加入下一組預填與休息計時，讓課程記錄更流暢。",
      "跑步加入跑鞋效能圖與互動能量實驗室，支援不同距離與天氣因素。",
    ],
  },
];
