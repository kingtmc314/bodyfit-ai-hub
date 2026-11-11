import { useEffect, useRef, useState } from 'react';
import createYouTubePlayer from 'youtube-player';
import type { YouTubePlayer } from 'youtube-player/dist/types';
import { AlertCircle, Loader2, Play, Pause, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';

export function officialVideoFrameUrl(videoId: string, origin: string): string {
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) throw new Error('官方影片編號無效。');
  const parsed = new URL(origin);
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('播放器來源無效。');
  const query = new URLSearchParams({ enablejsapi: '1', origin: parsed.origin, playsinline: '1', rel: '0', autoplay: '0' });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${query}`;
}
export function officialVideoError(code?: number): string {
  if (code === 101 || code === 150) return '原作者暫時不允許嵌入播放，請按「到官方來源觀看」。';
  if (code === 153) return '瀏覽器未提供影片所需的來源資料，請按「到官方來源觀看」。';
  if (code === 100) return '官方影片已移除或改為私人影片，請查看原作來源。';
  return '官方影片暫時未能載入。可重試，或到官方來源觀看；不會改用不同動作。';
}
export default function OfficialExerciseVideo({ videoId, exerciseName, sourceUrl }: { videoId: string; exerciseName: string; sourceUrl: string }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YouTubePlayer | null>(null);
  const [active, setActive] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const [speed, setSpeed] = useState('1');
  const [rates, setRates] = useState<number[]>([1]);
  useEffect(() => {
    if (!active || !host.current) return;
    const container = host.current;
    let disposed = false;
    let resolved = false;
    let api: YouTubePlayer | null = null;
    let stallTimeout: number | undefined;
    const clearStall = () => { if (stallTimeout !== undefined) window.clearTimeout(stallTimeout); stallTimeout = undefined; };
    setReady(false); setPlaying(false); setError(''); setSpeed('1'); setRates([1]);
    const timeout = window.setTimeout(() => { if (!disposed && !resolved) setError(officialVideoError()); }, 20000);
    try {
      const frame = document.createElement('iframe');
      frame.src = officialVideoFrameUrl(videoId, window.location.origin);
      frame.title = `${exerciseName} 官方動態示範`;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share';
      frame.allowFullscreen = true;
      frame.width = '100%'; frame.height = '100%';
      frame.className = 'absolute inset-0 h-full w-full border-0';
      container.replaceChildren(frame);
      api = createYouTubePlayer(frame);
      player.current = api;
      api.on('ready', async () => {
        resolved = true; window.clearTimeout(timeout);
        if (disposed) { void api?.destroy().catch(() => {}); return; }
        setReady(true);
        try { const available = await api!.getAvailablePlaybackRates(); if (!disposed) setRates(available.length ? [...available] : [1]); } catch { /* native controls remain available */ }
      });
      api.on('stateChange', event => {
        if (disposed) return;
        setPlaying(event.data === 1);
        clearStall();
        if (event.data === 3) stallTimeout = window.setTimeout(() => {
          if (disposed) return;
          setError('官方播放器已連接，但影片未能開始播放。可重試或到官方來源觀看；不會一直留在黑色載入畫面。');
          setReady(false); void api?.pauseVideo().catch(() => {});
        }, 20000);
      });
      api.on('playbackRateChange', event => { const value = (event as unknown as { data?: number }).data; if (!disposed && typeof value === 'number') setSpeed(String(value)); });
      api.on('error', event => {
        if (disposed) return;
        window.clearTimeout(timeout); clearStall(); setReady(false); setError(officialVideoError((event as unknown as { data?: number }).data));
      });
    } catch (cause) {
      window.clearTimeout(timeout);
      setError(cause instanceof Error ? cause.message : officialVideoError());
    }
    return () => {
      disposed = true; window.clearTimeout(timeout); clearStall(); player.current = null;
      if (resolved) { void api?.pauseVideo().catch(() => {}); void api?.destroy().catch(() => {}); }
      container.replaceChildren(); // synchronously stop an iframe even before its API is ready
    };
  }, [active, attempt, videoId, exerciseName]);
  const toggle = async () => {
    if (!player.current || !ready) return;
    try { if (playing) await player.current.pauseVideo(); else await player.current.playVideo(); }
    catch { setError(officialVideoError()); }
  };
  return <div data-official-exercise-video={error ? 'error' : ready ? 'ready' : active ? 'loading' : 'idle'}>
    <div className="relative aspect-[4/3] min-h-[200px] bg-[#101b24] text-white">
      <div ref={host} className="absolute inset-0" style={{ visibility: error ? 'hidden' : 'visible' }} />
      {!active && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center"><Play className="h-9 w-9"/><p className="text-sm">此器械的官方動態示範</p><Button type="button" onClick={() => setActive(true)}>開啟官方影片</Button><p className="text-[11px] text-white/70">按開啟才連接 YouTube；不自動播放。</p></div>}
      {active && !ready && !error && <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-[#101b24]/90 text-sm"><Loader2 className="h-4 w-4 animate-spin"/>正在連接官方播放器…</div>}
      {error && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center"><AlertCircle className="h-6 w-6"/><p className="text-sm">{error}</p><Button type="button" variant="secondary" onClick={() => setAttempt(value => value + 1)}>重試官方影片</Button></div>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 p-3">
      {active && <Button type="button" size="sm" variant="outline" disabled={!ready || !!error} onClick={() => void toggle()}>{playing ? <Pause className="mr-1.5 h-3.5 w-3.5"/> : <Play className="mr-1.5 h-3.5 w-3.5"/>}{playing ? '暫停示範' : '播放示範'}</Button>}
      {ready && !error && <label className="flex items-center gap-2 text-xs">速度<select aria-label="官方示範播放速度" className="rounded-lg border border-border bg-background p-2 text-foreground" value={speed} onChange={event => { setSpeed(event.target.value); void player.current?.setPlaybackRate(Number(event.target.value)).catch(() => setError(officialVideoError())); }}>{rates.filter(rate => rate >= .25 && rate <= 2).map(rate => <option key={rate} value={rate}>{rate}×{rate === .5 ? ' 慢速' : rate === 1 ? ' 正常' : ''}</option>)}</select></label>}
      <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs underline">到官方來源觀看<ExternalLink className="h-3 w-3"/></a>
    </div>
    {ready && <p className="px-3 pb-3 text-[11px] leading-5 text-muted-foreground">如手機攔截外部播放按鈕，可直接按影片內的播放鍵。示範是同類器械；品牌座椅、支點及配重仍須核對。</p>}
  </div>;
}
