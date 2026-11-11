import { lazy, Suspense } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, BookOpen, Lightbulb, AlertTriangle, Dumbbell, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EXERCISE_DESCRIPTIONS } from '@/data/exerciseDescriptions';
import ExerciseDemoPlayer from './ExerciseDemoPlayer';
import { getExerciseDemo } from '../../../shared/exerciseDemoCatalog';
import { getExerciseMuscles } from '../../../shared/exerciseMuscles';
const MuscleModel3D=lazy(()=>import('./MuscleModel3D'));
interface Exercise {name:string;nameZh?:string;muscleGroup:string;equipment:string;instructions?:string;}
interface Props {exercise:Exercise|null;open:boolean;onClose:()=>void;onAddToSession?:()=>void;hasActiveSession?:boolean;}
const descriptionAliases:Record<string,string>={'Dumbbell Fly':'Dumbbell Flyes','Push-up':'Push-Up','Pec Deck':'Pec Deck Machine'};
function description(name:string) {
  const exact=descriptionAliases[name]??name;
  return EXERCISE_DESCRIPTIONS[exact]??Object.entries(EXERCISE_DESCRIPTIONS).find(([key])=>key.toLowerCase()===exact.toLowerCase())?.[1];
}
export default function ExerciseDetailModal({exercise,open,onClose,onAddToSession,hasActiveSession}:Props) {
  const {i18n}=useTranslation();const isZh=i18n.language.startsWith('zh');
  if(!exercise)return null;
  const desc=description(exercise.name);const anatomy=getExerciseMuscles(exercise);const demo=getExerciseDemo(exercise.name,exercise.equipment);
  return <Dialog open={open} onOpenChange={next=>{if(!next)onClose();}}><DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto" style={{overscrollBehavior:'contain',WebkitOverflowScrolling:'touch'}}>
    <DialogHeader><DialogTitle className="flex items-center gap-2"><Dumbbell className="h-5 w-5 text-primary"/><span>{isZh?(exercise.nameZh||exercise.name):exercise.name}</span></DialogTitle><DialogDescription>{exercise.name} · {exercise.equipment} · 動態示範與肌群工作室</DialogDescription></DialogHeader>
    {open&&<div className="space-y-4" key={`${exercise.name}:${exercise.equipment}`}>
      <div className="flex flex-wrap gap-2"><Badge variant="secondary">{exercise.equipment}</Badge>{desc&&<Badge variant="outline">{({Beginner:'初級',Intermediate:'中級',Advanced:'高級'} as Record<string,string>)[desc.difficulty]??desc.difficulty}</Badge>}<Badge variant="outline">{anatomy.basis==='exercise'?'逐動作肌群':'分類肌群，需核對'}</Badge></div>
      <ExerciseDemoPlayer demo={demo} exerciseName={exercise.name}/>
      <Suspense fallback={<div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>正在載入肌群模型…</div>}><MuscleModel3D primary={anatomy.primary} secondary={anatomy.secondary}/></Suspense>
      {desc?<>{[
        {title:isZh?'動作步驟':'How to do it',items:isZh?desc.stepsZh:desc.steps,Icon:BookOpen},
        {title:isZh?'訓練提示':'Training tips',items:isZh?desc.tipsZh:desc.tips,Icon:Lightbulb},
        {title:isZh?'常見錯誤':'Common mistakes',items:isZh?desc.mistakesZh:desc.mistakes,Icon:AlertTriangle},
      ].map(({title,items,Icon})=><section key={title} className="rounded-2xl border border-border/50 p-4"><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-primary"/>{title}</h3><ol className="space-y-2">{items.map((item,i)=><li key={i} className="flex gap-3 text-sm leading-relaxed"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">{i+1}</span>{item}</li>)}</ol></section>)}</>:exercise.instructions?<section className="rounded-xl bg-muted/40 p-4 text-sm leading-relaxed">{exercise.instructions}</section>:null}
      <div className="flex gap-2 pt-2">{hasActiveSession&&onAddToSession&&<Button className="flex-1" onClick={()=>{onAddToSession();onClose();}}><Plus className="mr-2 h-4 w-4"/>{isZh?'加入訓練':'Add to session'}</Button>}<Button className="flex-1" variant="outline" onClick={onClose}>{isZh?'關閉':'Close'}</Button></div>
    </div>}
  </DialogContent></Dialog>;
}
