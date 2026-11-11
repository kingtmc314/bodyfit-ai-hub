import {describe,it,expect} from 'vitest';
import {getExerciseMuscles} from '../shared/exerciseMuscles';
import {MUSCLE_PARTS,muscleTone} from '../shared/muscleModel';
describe('exercise-specific anatomy',()=>{
  it('does not assign chest/back as secondary muscles to isolated curls or extensions',()=>{
    expect(getExerciseMuscles({name:'Cable Curl',muscleGroup:'biceps'})).toMatchObject({primary:['biceps'],secondary:[],basis:'exercise'});
    expect(getExerciseMuscles({name:'Leg Extension',muscleGroup:'quads'}).secondary).toEqual([]);
  });
  it('correctly distinguishes pulldown, chest press and overhead press',()=>{
    expect(getExerciseMuscles({name:'Lat Pulldown',muscleGroup:'lats'}).primary).toEqual(['lats']);
    expect(getExerciseMuscles({name:'Chest Press Machine',muscleGroup:'chest'}).primary).toEqual(['chest']);
    expect(getExerciseMuscles({name:'Overhead Press',muscleGroup:'shoulders'}).primary).toEqual(['shoulders']);
  });
  it('normalizes core but does not invent precise secondary activation for unknown/custom exercises',()=>{
    expect(getExerciseMuscles({name:'Custom',muscleGroup:'core'})).toEqual({primary:['abs','obliques'],secondary:[],basis:'category'});
    expect(getExerciseMuscles({name:'Treadmill',muscleGroup:'cardio'}).primary).toEqual([]);
  });
  it('contains finite bilateral front/back geometry for all named muscle groups',()=>{
    const groups=new Set(MUSCLE_PARTS.map(p=>p.group));
    for(const group of ['chest','back','lats','shoulders','biceps','triceps','abs','obliques','quads','hamstrings','glutes','calves','traps','forearms'])expect(groups.has(group)).toBe(true);
    for(const part of MUSCLE_PARTS){expect(part.position.every(Number.isFinite)).toBe(true);expect(part.scale.every(n=>n>0&&Number.isFinite(n))).toBe(true);}
    expect(muscleTone('chest',['chest'],['chest'])).toBe('primary');expect(muscleTone('back',[],['back'])).toBe('secondary');expect(muscleTone('back',[],[])).toBe('neutral');
  });
});
