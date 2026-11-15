import { ExternalLink, PlayCircle, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getGymworkReference } from "@shared/gymworkReferences";
export default function GymworkOriginalGuide({
  name,
  equipment,
}: {
  name: string;
  equipment: string;
}) {
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith("zh");
  const reference = getGymworkReference(name, equipment);
  return (
    <section
      data-gymwork-original-guide
      className="rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/70 to-white p-5 text-slate-800 dark:from-slate-900 dark:to-slate-950 dark:text-slate-100"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[.2em] text-blue-600">
          GYMWORK / ORIGINAL
        </span>
        <span className="text-[10px] text-muted-foreground">
          {zh ? "手機 · 平板 · 電腦" : "Phone · tablet · desktop"}
        </span>
      </div>
      <div className="flex min-h-36 flex-col items-center justify-center gap-3 text-center">
        <PlayCircle className="h-12 w-12 text-blue-500" />
        <h3 className="text-sm font-semibold">
          {reference
            ? reference.name
            : zh
              ? "此動作尚未有已核對的 Gymwork 原作頁"
              : "No exact Gymwork page has been verified for this exercise"}
        </h3>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          {zh
            ? "原作動畫在 Gymwork 官方頁面觀看。BodyFit 內嵌仍需素材／API 授權；目前沒有複製動畫，也不用 YouTube 或其他動畫替代。"
            : "Watch the original on Gymwork. Inline display requires a licensed asset/API; no animation is copied or replaced with YouTube or another animation."}
        </p>
      </div>
      <a
        href={reference?.url ?? "https://www.gymwork.pro/exercises"}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
      >
        <ExternalLink className="h-4 w-4" />
        {reference
          ? zh
            ? "在 Gymwork 看原作動畫"
            : "Watch the original on Gymwork"
          : zh
            ? "開啟 Gymwork 官方動作庫"
            : "Open the official Gymwork exercise library"}
      </a>
      <p className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {zh
          ? "保留 Gymwork 品牌及原作頁；不繞過官方網站的嵌入限制。"
          : "Gymwork branding and the original page are retained; site embedding restrictions are respected."}
      </p>
    </section>
  );
}
