import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
export const MUSCLE_LABELS:Record<string,[string,string]>={chest:['Chest','胸肌'],back:['Back','上背'],lats:['Lats','背闊肌'],lower_back:['Lower back','下背'],shoulders:['Shoulders','肩部'],biceps:['Biceps','二頭肌'],triceps:['Triceps','三頭肌'],forearms:['Forearms','前臂'],abs:['Abs','腹肌'],obliques:['Obliques','側腹'],quads:['Quadriceps','股四頭肌'],hamstrings:['Hamstrings','腿後肌'],glutes:['Glutes','臀大肌'],glute_medius:['Glute medius','臀中肌'],adductors:['Adductors','內收肌'],calves:['Calves','小腿'],traps:['Traps','斜方肌'],core:['Core','核心']};
export interface MuscleAreaMapProps {primary?:string[];secondary?:string[];values?:Record<string,number>;showLegend?:boolean;className?:string;}
type Area={id:string;path:string};
const front:Area[]=[
 {id:'chest',path:'M65 70Q88 65 98 81L98 106Q79 111 66 98Z M102 81Q113 65 135 70L134 98Q122 111 102 106Z'},
 {id:'shoulders',path:'M64 68Q50 66 46 89L56 101Q61 82 70 80Z M136 68Q150 66 154 89L144 101Q139 82 130 80Z'},
 {id:'biceps',path:'M47 94Q42 99 35 124L45 136Q56 117 55 102Z M153 94Q158 99 165 124L155 136Q144 117 145 102Z'},
 {id:'forearms',path:'M35 126L45 138Q40 157 28 176L21 171Z M165 126L155 138Q160 157 172 176L179 171Z'},
 {id:'abs',path:'M84 113H97V127H84Z M103 113H116V127H103Z M84 133H97V147H84Z M103 133H116V147H103Z M84 153H97V167H84Z M103 153H116V167H103Z'},
 {id:'obliques',path:'M65 109L79 115L77 165L67 172Q60 138 65 109Z M135 109L121 115L123 165L133 172Q140 138 135 109Z'},
 {id:'glute_medius',path:'M65 178L76 174L73 202L62 207Z M135 178L124 174L127 202L138 207Z'},
 {id:'quads',path:'M63 211Q78 194 84 206L87 260L76 290L66 281Z M137 211Q122 194 116 206L113 260L124 290L134 281Z'},
 {id:'adductors',path:'M88 201L97 193L96 242L89 273L85 250Z M112 201L103 193L104 242L111 273L115 250Z'},
 {id:'calves',path:'M69 302L81 297L83 331L74 365L68 350Z M131 302L119 297L117 331L126 365L132 350Z'},
];
const back:Area[]=[
 {id:'traps',path:'M80 58L98 71L98 94L64 80Z M120 58L102 71L102 94L136 80Z'},
 {id:'back',path:'M75 87L98 99V132L83 118Z M125 87L102 99V132L117 118Z'},
 {id:'lats',path:'M62 87L76 93L83 127L95 148L82 169L65 145Z M138 87L124 93L117 127L105 148L118 169L135 145Z'},
 {id:'lower_back',path:'M88 140L98 147V179L84 176Z M112 140L102 147V179L116 176Z'},
 {id:'shoulders',path:'M64 68Q50 66 46 89L56 101Q61 82 70 80Z M136 68Q150 66 154 89L144 101Q139 82 130 80Z'},
 {id:'triceps',path:'M47 94Q42 99 35 124L45 136Q56 117 55 102Z M153 94Q158 99 165 124L155 136Q144 117 145 102Z'},
 {id:'forearms',path:'M35 126L45 138Q40 157 28 176L21 171Z M165 126L155 138Q160 157 172 176L179 171Z'},
 {id:'glutes',path:'M68 179Q85 172 98 184V206Q86 217 68 204Z M132 179Q115 172 102 184V206Q114 217 132 204Z'},
 {id:'glute_medius',path:'M64 173L77 171L69 195L61 204Z M136 173L123 171L131 195L139 204Z'},
 {id:'hamstrings',path:'M66 214Q76 216 88 213L88 262L77 289L67 280Z M134 214Q124 216 112 213L112 262L123 289L133 280Z'},
 {id:'adductors',path:'M91 211L98 210L96 260L90 273Z M109 211L102 210L104 260L110 273Z'},
 {id:'calves',path:'M68 300Q74 292 85 301L84 334L74 365L66 347Z M132 300Q126 292 115 301L116 334L126 365L134 347Z'},
];
export default function MuscleAreaMap({primary=[],secondary=[],values,showLegend=true,className}:MuscleAreaMapProps){const {i18n}=useTranslation();const zh=i18n.language.startsWith('zh');const color=(id:string)=>{if(values&&Number.isFinite(values[id])&&values[id]>0)return '#3f77e8';return primary.includes(id)?'#3f77e8':secondary.includes(id)?'#94b5f5':'#d4d9e0';};const label=(id:string)=>MUSCLE_LABELS[id]?.[zh?1:0]??id;return <section data-muscle-area-map className={cn('rounded-2xl bg-slate-50 p-4 text-slate-800 dark:bg-slate-900 dark:text-slate-100',className)}>
 <div className="grid grid-cols-2 gap-3">{[['front',front],['back',back]].map(([side,areas])=><div key={String(side)}><p className="mb-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400">{side==='front'?(zh?'前面':'Front'):(zh?'後面':'Back')}</p><svg viewBox="8 0 184 398" className="mx-auto h-auto max-h-[330px] w-full" role="img" aria-label={`${side==='front'?(zh?'前面肌群':'Front muscle areas'):(zh?'後面肌群':'Back muscle areas')}`} xmlns="http://www.w3.org/2000/svg">
 <ellipse cx="100" cy="27" rx="18" ry="23" fill="#d8dde4"/><path d="M87 46V61L66 67Q52 70 44 95L31 131L16 171L9 182L14 191L25 185L38 166L50 137L62 111L60 159L64 181L59 211L64 290L65 352L61 380L64 389L79 390L88 378L90 320L93 276L99 232L101 232L107 276L110 320L112 378L121 390L136 389L139 380L135 352L136 290L141 211L136 181L140 159L138 111L150 137L162 166L175 185L186 191L191 182L184 171L169 131L156 95Q148 70 134 67L113 61V46Z" fill="#e1e5ea"/>
 {(areas as Area[]).map((a,index)=><path key={`${a.id}-${index}`} d={a.path} fill={color(a.id)} stroke="#f8fafc" strokeWidth="1.3" data-muscle-id={a.id} data-muscle-tone={primary.includes(a.id)?'primary':secondary.includes(a.id)?'secondary':(values?.[a.id]??0)>0?'volume':'neutral'}><title>{label(a.id)}</title></path>)}
 </svg></div>)}</div>
 {showLegend&&<div className="mt-4 space-y-3 border-t border-slate-200 pt-3 text-xs dark:border-slate-700">{values?<p className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-blue-500"/>{zh?'此期間有直接訓練量的肌群':'Muscles with direct training volume in this period'}</p>:<>{[[zh?'主要肌群':'Primary muscles',primary,'bg-blue-500'],[zh?'輔助肌群':'Secondary muscles',secondary,'bg-blue-300']].map(([title,ids,tone])=><div key={String(title)} className="flex flex-wrap items-start gap-2"><span className="inline-flex min-w-24 items-center gap-2 pt-1"><span className={cn('h-3 w-3 rounded-full',String(tone))}/>{String(title)}</span><div className="flex flex-1 flex-wrap gap-1.5">{(ids as string[]).map(id=><span key={id} className="rounded-full bg-white px-2.5 py-1 dark:bg-slate-800">{label(id)}</span>)}{!(ids as string[]).length&&<span className="py-1 text-slate-400">{zh?'未指定':'Not assigned'}</span>}</div></div>)}</>}
 <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">{zh?'肌群位置為概念示意；顏色表示動作分類或已記錄訓練量，不是實測活化、肌肉成長或疲勞。':'Schematic locations; colors indicate exercise classification or logged volume, not measured activation, growth or fatigue.'}</p></div>}
 </section>;}
