# Workout active-energy model v1

Version: BodyFit v3.16.0 · 2026-11-11 (Hong Kong UTC+8).

The previous app fixed today's start at noon and used elapsed wall-clock duration, a fixed 70 kg mass and volume-based MET bonuses. The live UI also added machine calories to a whole-session resistance estimate. Those are not defensible measures of work or metabolic intensity.

The new model uses the latest valid body mass on or before the Hong Kong session date, with a documented profile or 70 kg fallback. The adult Compendium defines 1 MET as approximately 1 kcal/kg/hour. Resistance moderate intensity is 3.5 MET (02054); vigorous is 6 MET (02050). Estimated activity energy is `(MET − 1) × mass_kg × minutes / 60`, excluding resting energy. Light 3 MET and unknown-cardio 5 MET are explicitly disclosed proxies, not personalized measurements. Lifted tonnage remains a workload metric and never increases the MET automatically.

Without reviewed duration, resistance time is derived from logged sets: approximately 3 seconds per rep and 75 seconds between sets, with bounded work duration per set. This is an app heuristic, not a published metabolic measurement. Users can review actual effective minutes and intensity before completing. A reference uncertainty range is shown; it is not a statistical confidence interval. Wall-clock inactivity does not accumulate calories. New durations above 180 minutes require correcting minutes or separating sessions; invalid historic durations are excluded rather than silently clamped into plausible values.

Cardio minutes are in minutes, not seconds. Explicit machine kcal are retained once; their active-versus-total basis is unknown. For mixed workouts, recorded cardio minutes are subtracted from the reviewed session duration before resistance energy is computed. Exact zero and explicit manual session values remain distinguishable from missing values. Running and steps estimates are outside this gym-model change, so their existing activity overlap is not asserted to be solved.

Legacy automatic kcal are recognized conservatively using the former algorithm's fingerprint. Identifiable automatic estimates are corrected on read only, while raw original duration and kcal remain available. Values with unknown provenance are preserved and flagged, not overwritten. Explicit user corrections store their provenance separately. Source values may coincide with the old fingerprint; legacy provenance cannot be reconstructed with certainty.

## Sources

- [2024 Adult Compendium, conditioning exercise](https://pacompendium.com/conditioning-exercise/): codes 02050, 02054, 02056 and conditioning cardio proxies.
- [Compendium definitions](https://pacompendium.com/): definition and limits of standardized MET values.

All estimates are educational tracking aids. They are not indirect calorimetry, measured muscle activation, an exact food allowance, or medical advice.
