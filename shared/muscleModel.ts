export type MusclePart = { group: string; position: [number,number,number]; scale: [number,number,number]; rotation?: number };
export const MUSCLE_PARTS: MusclePart[] = [];
for (const side of [-1,1]) {
  const add = (group:string, x:number,y:number,z:number,sx:number,sy:number,sz:number,rotation=0) => MUSCLE_PARTS.push({group,position:[side*x,y,z],scale:[sx,sy,sz],rotation:side*rotation});
  add('chest',.235,1.16,.16,.23,.145,.095);
  add('shoulders',.51,1.28,0,.15,.19,.18);
  add('biceps',.58,.98,.095,.09,.205,.085,-.15);
  add('triceps',.59,.98,-.095,.09,.20,.075,-.15);
  add('forearms',.67,.60,0,.08,.235,.09,-.20);
  add('obliques',.255,.79,.07,.07,.24,.09,.12);
  add('lats',.26,1.05,-.135,.18,.26,.075,.12);
  add('back',.13,1.12,-.16,.105,.23,.08);
  add('traps',.18,1.38,-.08,.20,.13,.085,-.35);
  add('glutes',.20,.49,-.11,.185,.18,.15);
  add('quads',.205,.17,.07,.135,.32,.12);
  add('hamstrings',.205,.17,-.10,.125,.31,.105);
  add('calves',.21,-.46,-.035,.105,.245,.12);
  for(let i=0;i<3;i++) add('abs',.07,1.02-i*.13,.16,.065,.06,.06);
}
export function muscleTone(group: string, primary: readonly string[], secondary: readonly string[]): 'primary'|'secondary'|'neutral' {
  return primary.includes(group) ? 'primary' : secondary.includes(group) ? 'secondary' : 'neutral';
}
