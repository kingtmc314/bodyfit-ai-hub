import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { APP_VERSION } from "@/lib/appMeta";
import { FEATURE_HISTORY, RELEASE_NOTES } from "@/lib/releaseNotes";
import { CheckCircle2, CircleDashed, History, ListTree, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CHANGE_GROUPS = [
  { key: "added", title: "新增功能", className: "border-emerald-300/40 bg-emerald-500/7", dotClass: "bg-emerald-500" },
  { key: "removed", title: "刪除功能", className: "border-rose-300/40 bg-rose-500/7", dotClass: "bg-rose-500" },
  { key: "improved", title: "優化功能", className: "border-sky-300/40 bg-sky-500/7", dotClass: "bg-sky-500" },
  { key: "revised", title: "修訂功能", className: "border-violet-300/40 bg-violet-500/7", dotClass: "bg-violet-500" },
] as const;

export default function ReleaseNotes() {
  const hasInProgress = RELEASE_NOTES.some((release) => release.status === "in-progress");

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-accent/10 p-5 shadow-sm md:p-7">
        <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <History className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold tracking-[0.14em] text-primary">BODYFIT AI HUB</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">版本歷程</h1>
              <p className="mt-1 text-sm text-muted-foreground">查看每個版本為你帶來的功能與體驗改善。</p>
            </div>
          </div>
          <div className="w-fit rounded-2xl border border-primary/20 bg-background/70 px-3 py-2 text-right backdrop-blur-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">目前正式版本</p>
            <p className="mt-0.5 text-sm font-extrabold text-primary">v{APP_VERSION}</p>
          </div>
        </div>
      </section>

      <Tabs defaultValue="versions" className="space-y-4">
        <TabsList className="grid h-auto w-full max-w-md grid-cols-2 rounded-xl p-1">
          <TabsTrigger value="versions" className="gap-1.5 text-xs sm:text-sm"><History className="h-3.5 w-3.5" />版本更新</TabsTrigger>
          <TabsTrigger value="features" className="gap-1.5 text-xs sm:text-sm"><ListTree className="h-3.5 w-3.5" />功能歷程</TabsTrigger>
        </TabsList>

      <TabsContent value="versions" aria-label="版本更新列表" className="space-y-4">
        {RELEASE_NOTES.map((release, index) => {
          const isInProgress = release.status === "in-progress";

          return (
            <article key={release.version} className="relative pl-7 sm:pl-10">
              {index < RELEASE_NOTES.length - 1 && (
                <span className="absolute left-[9px] top-8 bottom-[-1.25rem] w-px bg-border sm:left-[13px]" aria-hidden="true" />
              )}
              <span
                className={isInProgress
                  ? "absolute left-0 top-5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary bg-background text-primary sm:h-7 sm:w-7"
                  : "absolute left-0 top-5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground sm:h-7 sm:w-7"}
                aria-hidden="true"
              >
                {isInProgress ? <CircleDashed className="h-3 w-3 sm:h-4 sm:w-4" /> : <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4" />}
              </span>

              <Card className={isInProgress ? "border-primary/35 bg-primary/[0.035] shadow-md" : "bg-card/90"}>
                <CardContent className="space-y-4 px-4 py-5 sm:px-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-extrabold tracking-tight text-foreground">v{release.version}</h2>
                        <Badge
                          variant={isInProgress ? "default" : "secondary"}
                          className={isInProgress ? "gap-1 bg-primary text-primary-foreground" : "gap-1 bg-accent/15 text-accent-foreground dark:bg-accent/20"}
                        >
                          {isInProgress ? <Sparkles className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                          {isInProgress ? "進行中" : "已發布"}
                        </Badge>
                      </div>
                      <h3 className="mt-1 text-base font-bold text-foreground">{release.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{release.summary}</p>
                    </div>
                  </div>

                  <div className="grid gap-2.5 border-t border-border/80 pt-4 sm:grid-cols-2">
                    {CHANGE_GROUPS.map((group) => (
                      <section key={group.key} className={`rounded-xl border p-3 ${group.className}`}>
                        <h4 className="mb-1.5 text-xs font-extrabold tracking-wide text-foreground">{group.title}</h4>
                        <ul className="space-y-1.5">
                          {release.changes[group.key].map((change) => (
                            <li key={change} className="flex items-start gap-2 text-xs leading-5 text-foreground/80">
                              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${group.dotClass}`} aria-hidden="true" />
                              <span>{change}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </article>
          );
        })}
      </TabsContent>

      <TabsContent value="features" className="space-y-4">
        <section aria-label="功能歷程列表" className="grid gap-4 md:grid-cols-2">
          {FEATURE_HISTORY.map((feature) => {
            const isInProgress = feature.status === "in-progress";
            return <Card key={feature.feature} className={isInProgress ? "border-primary/35 bg-primary/[0.035]" : "bg-card/90"}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold tracking-wide text-primary">功能歷程</p>
                    <h2 className="mt-1 text-base font-extrabold text-foreground">{feature.feature}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{feature.summary}</p>
                  </div>
                  <Badge variant={isInProgress ? "default" : "secondary"} className={isInProgress ? "shrink-0 bg-primary text-primary-foreground" : "shrink-0 bg-accent/15 text-accent-foreground"}>{isInProgress ? "進行中" : "已發布"}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-border/70 bg-muted/25 p-3 text-xs">
                  <div><p className="text-[10px] font-bold tracking-wider text-muted-foreground">最後修訂版本</p><p className="mt-1 font-extrabold text-primary">v{feature.lastRevisedVersion}</p></div>
                  <div><p className="text-[10px] font-bold tracking-wider text-muted-foreground">最後修訂日期</p><p className="mt-1 font-semibold text-foreground">{feature.lastRevisedDateHK}</p></div>
                </div>
                <ol className="mt-4 space-y-2 border-l border-border pl-3.5">
                  {feature.history.map((entry) => <li key={`${entry.version}-${entry.dateHK}`} className="relative text-xs leading-5 text-foreground/80"><span className="absolute -left-[1.05rem] top-1.5 h-2 w-2 rounded-full border-2 border-card bg-primary" /><b className="text-foreground">v{entry.version}</b><span className="text-muted-foreground"> · {entry.dateHK}</span><p className="mt-0.5">{entry.description}</p></li>)}
                </ol>
              </CardContent>
            </Card>;
          })}
        </section>
      </TabsContent>
      </Tabs>

      {hasInProgress && (
        <p className="px-2 text-center text-xs leading-5 text-muted-foreground">
          「進行中」項目只代表目前已納入產品的變更；正式發布後會更新為已發布版本。
        </p>
      )}
    </div>
  );
}
