import { cn } from "@/lib/utils";
import { isStaleAssetError, recoverFromStaleAsset, STALE_ASSET_RELOAD_KEY } from "@/lib/assetRecovery";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    recoverFromStaleAsset(error);
  }

  private reloadPage = () => {
    try {
      window.sessionStorage.removeItem(STALE_ASSET_RELOAD_KEY);
    } catch {
      // The browser can deny session storage in strict private browsing.
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isStaleAsset = isStaleAssetError(this.state.error);
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-3">
              {isStaleAsset ? "應用程式正在更新" : "發生未預期錯誤"}
            </h2>

            <div className="p-4 w-full rounded bg-muted text-center text-sm text-muted-foreground mb-6">
              {isStaleAsset
                ? "偵測到新版本已部署。頁面會自動重新載入一次；如仍未恢復，請按下方按鈕。"
                : "請重新載入頁面後再試。如問題持續出現，請把此畫面的截圖傳給我們。"}
            </div>

            <button
              onClick={this.reloadPage}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              重新載入頁面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
