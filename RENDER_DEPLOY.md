# BodyFit AI Hub — Render 部署指南 (Auto-Deploy via GitHub)

> **自動部署：** 每次推送至 `main` 分支，Render 會在約 2 分鐘內自動重新部署。

---

## 前置條件

- GitHub 帳號，已有此 repo：`kingtmc314/bodyfit-ai-hub`
- Render 帳號：https://render.com（免費方案可用）
- Supabase 資料庫（已設置：life-OS project）

---

## Step 1 — 在 Render 建立 Web Service

1. 前往 https://render.com，以 GitHub 帳號登入
2. 點擊 **New** → **Web Service**
3. 連接 GitHub，選擇 repo：`kingtmc314/bodyfit-ai-hub`
4. 填寫以下設定：

| 設定 | 值 |
|------|-----|
| **Name** | `bodyfit-ai-hub` |
| **Region** | Singapore（離香港最近） |
| **Branch** | `main` |
| **Runtime** | Node |
| **Build Command** | `pnpm install && pnpm build` |
| **Start Command** | `node dist/index.js` |
| **Plan** | Free（或 Starter 以獲得更好效能） |

5. 點擊 **Advanced** → **Add Environment Variable**，依下表新增所有環境變數：

---

## Step 2 — 設置環境變數

| Key | 說明 | 如何取得 |
|-----|------|---------|
| `NODE_ENV` | `production` | 直接填入 |
| `SUPABASE_DATABASE_URL` | Supabase Session Pooler 連線字串 | Supabase → Settings → Database → Session Pooler |
| `JWT_SECRET` | 任意 32 位以上隨機字串 | 可用 `openssl rand -hex 32` 生成 |
| `VITE_APP_ID` | Manus OAuth App ID | Manus 開發者設定 |
| `OAUTH_SERVER_URL` | `https://api.manus.im` | 直接填入 |
| `VITE_OAUTH_PORTAL_URL` | `https://manus.im` | 直接填入 |
| `OWNER_OPEN_ID` | 你的 Manus OpenID | Manus 帳戶設定 |
| `OWNER_NAME` | 你的名字 | 直接填入 |
| `BUILT_IN_FORGE_API_URL` | Manus Forge API URL | Manus 開發者設定 |
| `BUILT_IN_FORGE_API_KEY` | Manus Forge API Key（伺服器端） | Manus 開發者設定 |
| `VITE_FRONTEND_FORGE_API_KEY` | Manus Forge Key（前端） | Manus 開發者設定 |
| `VITE_FRONTEND_FORGE_API_URL` | Manus Forge URL（前端） | Manus 開發者設定 |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google 服務帳號 JSON（壓縮成一行） | Google Cloud Console |

> **注意：** `STORAGE_*` 變數（S3）如需進度照片上傳功能才需設置。

---

## Step 3 — 設置 Manus OAuth 回調 URL

部署完成後，Render 會提供一個 URL，格式為：
`https://bodyfit-ai-hub.onrender.com`

在 Manus 開發者設定中，將以下 URL 加入允許的 redirect：
```
https://bodyfit-ai-hub.onrender.com/api/oauth/callback
```

---

## Step 4 — Google Sheets 整合（可選）

1. 將你的 Google 試算表分享給 `GOOGLE_SERVICE_ACCOUNT_JSON` 中的服務帳號 email
2. Email 格式：`xxx@your-project.iam.gserviceaccount.com`
3. 給予 **Editor** 權限

---

## 自動部署流程

```bash
# 本地修改後，推送至 GitHub
git add .
git commit -m "Update feature"
git push origin main
# Render 自動在約 2 分鐘內重新部署 ✅
```

每次推送至 `main` 分支，Render 會自動：
1. 拉取最新代碼
2. 執行 `pnpm install && pnpm build`
3. 重啟服務
4. 健康檢查通過後上線（`GET /api/health`）

---

## 健康檢查

服務啟動後可訪問：
```
GET https://bodyfit-ai-hub.onrender.com/api/health
→ { "ok": true, "version": "1.0.0" }
```

---

## 費用參考

| 方案 | 費用 | RAM | CPU | 備注 |
|------|------|-----|-----|------|
| Free | $0/月 | 512 MB | 0.1 CPU | 閒置 15 分鐘後休眠，首次請求需等待 ~30 秒 |
| Starter | $7/月 | 512 MB | 0.5 CPU | 永遠在線，推薦正式使用 |
| Standard | $25/月 | 2 GB | 1 CPU | 高流量使用 |

**建議：** 先用 Free 方案測試，確認一切正常後升級至 Starter。
