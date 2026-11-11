export type ExerciseMuscleInput = { name: string; muscleGroup: string };
export type ExerciseMuscles = { primary: string[]; secondary: string[]; basis: 'exercise' | 'category' };
const muscles: Record<string, [string[], string[]]> = {
  'Bench Press': [['chest'], ['triceps', 'shoulders']],
  'Incline Bench Press': [['chest'], ['shoulders', 'triceps']],
  'Decline Bench Press': [['chest'], ['triceps', 'shoulders']],
  'Close-grip Bench Press': [['triceps'], ['chest', 'shoulders']],
  'Chest Press Machine': [['chest'], ['triceps', 'shoulders']],
  'Dumbbell Fly': [['chest'], ['shoulders']], 'Cable Crossover': [['chest'], ['shoulders']],
  'Pec Deck': [['chest'], []], 'Push-up': [['chest'], ['triceps', 'shoulders', 'abs']],
  'Deadlift': [['glutes', 'hamstrings', 'back'], ['quads', 'forearms', 'traps']],
  'Romanian Deadlift': [['hamstrings', 'glutes'], ['back', 'forearms']],
  'Squat': [['quads', 'glutes'], ['abs', 'back']],
  'Leg Press': [['quads', 'glutes'], ['hamstrings']], 'Leg Extension': [['quads'], []],
  'Leg Curl': [['hamstrings'], []], 'Lunge': [['quads', 'glutes'], ['hamstrings', 'abs']],
  'Bulgarian Split Squat': [['quads', 'glutes'], ['hamstrings', 'abs']],
  'Hip Thrust': [['glutes'], ['hamstrings']], 'Glute Bridge': [['glutes'], ['hamstrings']],
  'Standing Calf Raise': [['calves'], []], 'Seated Calf Raise': [['calves'], []],
  'Pull-up': [['lats', 'back'], ['biceps', 'forearms']],
  'Lat Pulldown': [['lats'], ['biceps', 'back']],
  'Seated Cable Row': [['back', 'lats'], ['biceps', 'shoulders']],
  'Bent-over Barbell Row': [['back', 'lats'], ['biceps', 'hamstrings']],
  'Single-arm Dumbbell Row': [['back', 'lats'], ['biceps']],
  'T-Bar Row': [['back', 'lats'], ['biceps']], 'Hyperextension': [['back'], ['glutes', 'hamstrings']],
  'Overhead Press': [['shoulders'], ['triceps', 'abs']],
  'Dumbbell Shoulder Press': [['shoulders'], ['triceps']], 'Shoulder Press Machine': [['shoulders'], ['triceps']],
  'Arnold Press': [['shoulders'], ['triceps']],
  'Lateral Raise': [['shoulders'], []], 'Front Raise': [['shoulders'], []],
  'Rear Delt Fly': [['shoulders'], ['back']], 'Face Pull': [['shoulders', 'back'], ['traps']],
  'Barbell Curl': [['biceps'], ['forearms']], 'Dumbbell Curl': [['biceps'], ['forearms']],
  'Hammer Curl': [['biceps', 'forearms'], []], 'Preacher Curl': [['biceps'], []],
  'Cable Curl': [['biceps'], []], 'Concentration Curl': [['biceps'], []],
  'Tricep Dip': [['triceps'], ['chest', 'shoulders']], 'Tricep Pushdown': [['triceps'], []],
  'Skull Crusher': [['triceps'], []], 'Overhead Tricep Extension': [['triceps'], []], 'Tricep Kickback': [['triceps'], []],
  'Crunch': [['abs'], []], 'Plank': [['abs'], ['shoulders', 'glutes']],
  'Cable Crunch': [['abs'], []], 'Hanging Leg Raise': [['abs'], ['forearms']],
  'Russian Twist': [['obliques'], ['abs']], 'Ab Wheel Rollout': [['abs'], ['lats', 'shoulders']],
  'Barbell Shrug': [['traps'], ['forearms']], 'Dumbbell Shrug': [['traps'], ['forearms']],
  'Upright Row': [['shoulders', 'traps'], ['biceps']],
  'Wrist Curl': [['forearms'], []], 'Reverse Curl': [['forearms', 'biceps'], []],
  "Farmer's Walk": [['forearms', 'traps'], ['abs', 'glutes']],
};
export function getExerciseMuscles(exercise: ExerciseMuscleInput): ExerciseMuscles {
  const key = Object.keys(muscles).find(name => name.toLowerCase() === exercise.name.toLowerCase());
  if (key) return { primary: [...muscles[key][0]], secondary: [...muscles[key][1]], basis: 'exercise' };
  const primary = exercise.muscleGroup === 'core' ? ['abs', 'obliques'] : exercise.muscleGroup === 'cardio' ? [] : [exercise.muscleGroup];
  return { primary, secondary: [], basis: 'category' };
}
