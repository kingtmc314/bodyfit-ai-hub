import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Play, Pause, AlertCircle, ExternalLink } from 'lucide-react';
import OfficialExerciseVideo from './OfficialExerciseVideo';
export type ExerciseDemoAsset = { url: string; kind: 'video'|'gif'|'youtube'; videoId?: string; sourceUrl: string; license: string; author: string; title: string; posterUrl?: string; licenseUrl?: string; changes?: string };
export default function ExerciseDemoPlayer({demo,exerciseName}:{demo?:ExerciseDemoAsset;exerciseName:string}) {
  const video=useRef<HTMLVideoElement>(null);const [playing,setPlaying]=useState(false);const [failed,setFailed]=useState(false);const [speed,setSpeed]=useState('1');
  useEffect(()=>{const previous=video.current;setPlaying(false);setFailed(false);setSpeed('1');return()=>{previous?.pause();};},[demo?.url]);
  const toggle=async()=>{if(demo?.kind==='gif'){setPlaying(!playing);return;}const v=video.current;if(!v)return;try{if(v.paused)await v.play();else v.pause();}catch{setFailed(true);}};
  if(!demo) return <div className="rounded-2xl border border-dashed border-border bg-muted/25 p-5" data-exercise-demo="unavailable"><p className="text-sm font-semibold">尚未有此動作的已核實動態示範</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">不以其他器械或不同動作影片代替。仍可查看下方肌群及步驟；自訂器械可影相辨識後核對新增，首次操作請向教練確認。</p></div>;
  return <section data-exercise-demo={demo.kind} className="overflow-hidden rounded-2xl border border-border/50 bg-muted/20">
    {demo.kind==='youtube'?<OfficialExerciseVideo key={demo.videoId} videoId={demo.videoId??''} exerciseName={exerciseName} sourceUrl={demo.sourceUrl}/>:<>
      <div className="relative aspect-[4/3] bg-[#101b24] flex items-center justify-center">
        {failed?<div role="alert" className="p-5 text-center text-white"><AlertCircle className="mx-auto mb-2 h-6 w-6"/><p className="text-sm">示範暫時未能載入</p><Button type="button" className="mt-3" variant="secondary" onClick={()=>{setFailed(false);}}>重試示範</Button></div>
          : demo.kind==='video'?<video ref={video} src={demo.url} poster={demo.posterUrl} preload="metadata" controls playsInline loop className="h-full w-full object-contain" aria-label={`${exerciseName} 動態示範`} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onError={()=>setFailed(true)}/>
          :playing?<img src={demo.url} alt={`${exerciseName} 動態示範`} className="h-full w-full object-contain" onError={()=>setFailed(true)}/>:<div className="text-center text-white"><Play className="mx-auto mb-2 h-8 w-8"/><p className="text-sm">按播放查看完整動作</p></div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 p-3"><Button type="button" size="sm" variant="outline" disabled={failed} onClick={()=>void toggle()}>{playing?<Pause className="mr-1.5 h-3.5 w-3.5"/>:<Play className="mr-1.5 h-3.5 w-3.5"/>}{playing?'暫停示範':'播放示範'}</Button>
        {demo.kind==='video'&&<label className="flex items-center gap-2 text-xs">速度<select aria-label="示範播放速度" value={speed} className="rounded-lg border border-border bg-background p-2 text-foreground" onChange={e=>{setSpeed(e.target.value);if(video.current)video.current.playbackRate=Number(e.target.value);}}><option value="0.5">0.5× 慢速</option><option value="1">1× 正常</option><option value="1.5">1.5×</option></select></label>}
      </div>
    </>}
    <div className="border-t border-border/40 p-3 text-[10px] leading-relaxed text-muted-foreground"><p>已核對動作：{demo.title} · {demo.author} · {demo.license}</p><div className="flex flex-wrap gap-x-3"><a href={demo.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 underline">原作來源<ExternalLink className="h-3 w-3"/></a>{demo.licenseUrl&&<a href={demo.licenseUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 underline">{demo.kind==='youtube'?'嵌入使用條款':'授權條款'}<ExternalLink className="h-3 w-3"/></a>}</div>{demo.changes&&<p className="mt-1">{demo.kind==='youtube'?'影片使用：':'影片修改：'}{demo.changes}</p>}<p className="mt-1">影片用作動作示範，並非對你本人姿勢的評估；不同器械的座椅、支點及配重請按現場設定。</p></div>
  </section>;
}
