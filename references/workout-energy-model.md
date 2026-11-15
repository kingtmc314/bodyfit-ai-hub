# Gym workout volume-dependent energy model

Model `workout-volume-v2` · research checked 2026-11-15, Hong Kong UTC+8. Scope is gym resistance work and gym cardio only. No historical migration, bulk health-data writes, running/steps changes, commits or checkpoints are part of this work.

## What changes the estimate

Recorded external load now directly changes the resistance-energy estimate at the same repetitions, set count and working time. Volume is `Σ(load_kg × repetitions)` over completed resistance rows. Three rows of 40 kg × 10 reps mean 1,200 kg·rep, not 3,600 kg·rep. A row represents one set; `setNumber` is position, not another multiplier. Cardio rows are excluded from resistance volume. Body mass is separate, never inserted into the displayed external-load volume.

The 2024 scoping review finds that resistance-exercise energy depends on movement, recruited muscle mass, velocity, effort and recovery, including expenditure when no external work occurs. MET values or lifted mass alone cannot measure these effects. This implementation is a transparent, bounded tracking heuristic, not a validated calorie predictor, and makes no claim to greater measured accuracy. [1]

For each dynamic set with recorded repetitions:

```text
external_work_J = logged_load_kg × 9.80665 × assumed_positive_displacement_m × reps
body_movement_work_J = body_mass_kg × assumed_body_mass_fraction
                       × 9.80665 × assumed_positive_displacement_m × reps
external_energy_kcal = external_work_J / 4184 / 0.25
body_movement_energy_kcal = body_movement_work_J / 4184 / 0.25
internal_support_kcal = support_active_MET_equivalent × body_mass_kg
                        × working_minutes / 60 × intensity_factor
recovery_kcal = recovery_active_MET_equivalent × body_mass_kg × recovery_minutes / 60
resistance_kcal = external_energy + body_movement_energy + internal_support + recovery
```

Only positive load-path displacement is counted. The return/lowering stroke is not doubled or subtracted from it. `9.80665 m/s²` and `4,184 J/kcal` are unit constants. The displacement, moving-body fractions, support rates, recovery rates and 25% efficiency below are application assumptions, not measured parameters. Efficiency varies with contraction and movement; isometric contraction can expend metabolic energy with zero external work. The 2017 review provides positive-work efficiency examples around 25%, but does not validate this coefficient for a gym exercise or an individual. [2]

The 25% assumption is used as an idealized incremental mechanical-work conversion, not a measured whole-body net efficiency. The body-movement and internal-support terms allocate different modeled costs; that separation itself has not been calibrated against calorimetry. Some real physiological costs may overlap or be omitted. The important software constraint is that the old whole-session `(MET − 1) × body_mass × time` resistance estimate is replaced, not added on top of mechanical work. `resistanceMet` remains only a descriptive gross-MET equivalent calculated from the final result; it is not an input or a claimed Compendium activity code.

## Exact application assumptions

Movement class is inferred from the logged English or supported Chinese exercise name. These are coarse defaults; they are not an exercise-specific biomechanical assessment.

- **Lower compound** — squat, lunge, step-up: 0.45 m positive path, 0.50 body-mass fraction, 2.2 active-MET-equivalent internal support.
- **Hip hinge** — deadlift, hip thrust, good morning: 0.50 m, 0.35 fraction, 2.0 support.
- **Machine lower** — leg press, hack squat: 0.30 m, 0.02 fraction, 2.0 support. A supported body is not treated as a free squat's moving body mass; sled angles and machine leverage remain unknown and warned.
- **Hip isolation** — hip adduction/abduction and adductor/abductor machine: 0.20 m, 0.02 fraction, 1.4 support. The displacement is a crude resistance-path assumption, not a measured stack travel or hip angle.
- **Upper push** — press: 0.35 m, 0.05 fraction, 1.6 support.
- **Upper pull** — row, pulldown, face pull: 0.40 m, 0.05 fraction, 1.6 support.
- **Isolation** — curl, extension, raise, fly: 0.25 m, 0.02 fraction, 1.4 support.
- **Bodyweight push** — push-up, dip: 0.20 m, 0.65 fraction, 1.8 support.
- **Bodyweight pull** — pull-up, chin-up: 0.40 m, 0.90 fraction, 1.8 support.
- **Named assisted bodyweight** — assisted pull-up/chin-up/dip: 0 m, 0 fraction, 1.8 support. Unconfirmed assistance-counterweight and body-displacement work are excluded; heavier assistance cannot increase modeled mechanical energy. Literal recorded volume remains visible, with a dedicated warning.
- **Core** — crunch, sit-up, ab wheel: 0.15 m, 0.15 fraction, 1.6 support.
- **Isometric/hold** — plank, wall sit, dead hang and named holds: 0 m, 0 fraction, 2.0 support. Recorded load/reps can remain in the volume summary, but never become dynamic mechanical work.
- **Unknown strength** — 0.30 m, 0.10 fraction, 1.6 support, with a warning to verify the movement.

Intensity affects internal support only by factors of 0.8 / 1.0 / 1.25 for light / moderate / vigorous. It does not change the mechanical-work formula. Between-set recovery uses 0.50 / 0.75 / 1.00 active-MET equivalent respectively, with no recovery added after the final set and no training-afterburn estimate. The review supports accounting for recovery but does not validate these default rates or durations. [1]

Explicit set duration is in minutes. When absent, working time is 3 seconds per rep, bounded to 15–90 seconds per nonempty rep set. Recovery is at most 75 seconds per gap between recorded sets. These timing choices are product heuristics, not measured lifting cadence or recorded rest.

## Missing data and equipment ambiguity

Missing external load does not become invented kg: external volume and external work for that row are zero, while recorded body movement, internal support and bounded recovery can remain positive. Missing body mass uses the latest valid measurement on or before the Hong Kong session date, then a valid profile value, then a warned 70 kg assumption. Future body measurements are never used.

For explicitly timed strength without reps, the model does not invent reps. It produces no dynamic external or body-displacement work, while internal support still estimates the recorded working minutes. Known timed presses and named holds stay resistance activities, not duration-only cardio. Custom unknown timed activities need an explicit resistance category or `isCardio: false`; otherwise existing cardio inference remains and the cardio proxy warning is shown. Completely empty rows create no activity energy.

All positive entered loads are conservatively marked equipment-ambiguous, because set records do not establish whether the number is total dumbbell load, single-hand load, plates only, resistance-stack mass, leverage-adjusted resistance or an assistance counterweight. The software never silently multiplies by two, by set position, or by a pulley ratio. Explicitly named assisted pull-up/chin-up/dip entries exclude the recorded assistance weight and unconfirmed body-displacement work from mechanical energy; increasing assistance at identical reps/time does not increase energy. The support/recovery estimate remains meaningful and nonzero. Literal kg·rep is retained for original-record consistency, not described as actual lifting tension or actual external work. An ambiguously named ordinary pull-up/dip still needs user review to establish added load versus assistance. Equal external volume can give different estimates because assumed displacement, moved body fraction and support differ. Unknown movements with missing load explicitly warn that the generic body fraction is neither measured moved body mass nor measured muscle activation.

## Bounded energy and independent actual duration

The smaller valid reviewed-duration or available-time cap is used after subtracting logged cardio minutes. A longer reviewed lesson duration or idle wall time does not add resistance work or unlimited recovery. If available resistance minutes are below the logged-work-plus-recovery heuristic, all energy components and modeled minutes scale proportionally. Original volume, repetitions and mechanical-work assumptions remain intact. The UI exposes the applied energy scale and warns about inconsistent timing. Reviewed zero permits zero estimated energy; a manual or machine zero remains authoritative independently.

The central estimate has an application safety ceiling of `8 × body_mass × modeled_work_minutes / 60 + recovery_energy`. If mechanical energy exceeds this ceiling, all resistance-energy components scale down proportionally and `capped` plus a warning are returned. This is not a physiological maximum or an accuracy guarantee. Energy can plateau for extreme loads, so load monotonicity is not strict after safety saturation. The ceiling and timing scaling prevent extreme input-derived energy from appearing as an unconstrained mechanical prediction.

Resistance low/high values use 0.50× / 1.75× of the central estimate. These are broad heuristic sensitivity multipliers, not statistically established error bounds or a confidence interval; actual expenditure may fall outside them. Estimates are rounded at total/legacy-compatible component kcal boundaries; detailed component metrics retain fractional values. The summary therefore supports explaining small estimates instead of claiming exact whole-kcal measurement.

Actual course duration remains independent. This service never persists rep-derived `effectiveMinutes` as actual duration, never infers an actual duration from idle elapsed time, and does not replace corrupt legacy 694-minute courses with a plausible guessed course length. Reviewed minutes, original-but-unverified minutes, unknown duration and elapsed wall time remain distinguishable.

New inputs reject unsafe minutes, reps outside 0–200, load outside 0–1,000 kg, machine kcal outside 0–3,000, body mass outside 20–350 kg, and manual kcal outside 0–10,000. Tolerant historical reads exclude invalid reps/load/time/unsafe manual values, preserve raw originals and issue warnings rather than letting one corrupt record fail the whole history. Invalid verified metadata does not become reviewed zero. Accumulated modeled activity above 180 minutes is rejected on new inputs or excluded with a warning on tolerant reads; invalid time is not silently clamped to a large plausible value.

## Cardio and manual values

Explicit gym device calories, including zero, are counted once rather than added to another estimate for the same cardio row. Their active-versus-total basis is unknown and the UI warns about measurement uncertainty. If minutes are known but device kcal or speed/power are missing, cardio retains the disclosed 5 MET conditioning proxy and subtracts one resting MET: `(5 − 1) × body_mass × minutes / 60`. The Compendium is an activity reference, not evidence of individual resistance prediction accuracy. [3]

Cardio heuristic low/high values remain 0.65× / 1.50×; reported-device low/high values remain 0.80× / 1.20×, also not validated error bounds. A valid manual session total, including zero, overrides the session estimate and range exactly. Separate component estimates remain explanatory only; the UI must not add them to the manual total. A manual total has unknown active/gross basis.

## Historical provenance and read-only behavior

Both `workout-volume-v2` and saved `workout-active-v1` metadata are recognized. V1 is not misclassified as a manual value simply because its version differs. Its manual zero or nonzero, explicit reviewed time, live/historical mode, finished flag, origin, weight override and `rawOriginalCalories` survive read-model recomputation. The service supplies the recognized old timing metadata to the existing timing helper using a projected current version, without changing the stored record or treating derived minutes as reviewed.

Session/history getters produce a v2 read model without any writes. Raw database kcal, raw duration and original kcal evidence remain available. The earlier pre-v1 fixed-70-kg/volume-threshold algorithm is recognized only by its rounded fingerprint; unidentifiable valid values are preserved as unknown/manual with a warning. Coincidental fingerprints are possible, so provenance cannot be reconstructed perfectly.

Explicit single-session/set edits may maintain that record's totalVolume. Automatic calorie refresh only applies to new v2 sessions, never silently upgrading v1/historical calorie metadata. A non-energy location/name edit of v1 does not rewrite saved calories. User-confirmed timing or manual corrections may update that one session with original evidence retained; those are not a bulk migration. Repeated finish remains idempotent.

## Returned summary contract and examples

`WorkoutCalorieEstimate` adds optional `modelVersion`, `totalVolumeKgReps` and `volume` to remain compatible with older UI fixtures; every v2 result returns all three. The top-level volume value is a convenience alias of `volume.totalVolumeKgReps`. `WorkoutCalorieDetails.volume` is required. `volume` includes original recorded kg·rep volume, reps, completed set count, missing-load count, equipment-ambiguity count, assumed efficiency, modeled work/recovery minutes, raw assumed external/body work in joules, applied component kcal, the applied energy scale, ceiling information and each movement's assumption. Raw joules are not time-scaled; kcal components are. `warnings` are user-facing Traditional Chinese explanations suitable for the existing UI.

Synthetic arithmetic examples, not validated predictions: at 80 kg body mass, twelve Bench Press rows of 40 kg × 10 reps yield 4,800 kg·rep, 6 modeled work minutes plus 13.75 recovery minutes, and approximately 44 kcal central resistance energy. One 40 kg × 10 rep Bench Press row over 0.5 minutes yields approximately 2.51 kcal before rounding; changing load to 100 kg at the same reps/time increases its mechanical component. Giving either workout a 60- or 180-minute reviewed lesson duration does not manufacture additional strength work. A device report of 130 kcal for 20 minutes adds 130 once. A two-minute Plank at 60 kg body mass estimates 4 kcal support and zero external work.

All results are educational tracking aids, not indirect calorimetry, measured muscle activation, an exact food allowance or medical advice.

## References

[1]: https://pmc.ncbi.nlm.nih.gov/articles/PMC11393209/ "Methods to Assess Energy Expenditure of Resistance Exercise: A Systematic Scoping Review, 2024"
[2]: https://www.germanjournalsportsmedicine.com/archive/archive-2017/heft-9/the-efficiency-of-muscular-exercise "The Efficiency of Muscular Exercise, 2017"
[3]: https://pacompendium.com/conditioning-exercise/ "2024 Adult Compendium: Conditioning Exercise"
