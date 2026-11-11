# BodyFit verified exercise demos

**20 of the repository's actual 67 builtin exercises have verified exact-motion videos; 47 have no exact verified demo.** All shipped media are real H.264 MP4 video, not two still pictures. The source-library claim of “966 exercises” does not imply 966 animations: the public wger snapshot contained 78 video records across 46 exercises on 2026-11-11. The catalog deliberately does not substitute different equipment or a different motion. [1]

The shared API is `getExerciseDemo(name, equipment?)`, returning `{url, kind, sourceUrl, license, author, title, posterUrl?, licenseUrl?, changes?}` or `undefined`. `exerciseDemoCatalog`, `EXERCISE_DEMO_CATALOG`, `unavailableExerciseDemoNames`, and `exerciseDemoCoverage` are also exported. Equipment must match exactly except deliberately equivalent spelling such as Cable/Cable machine and EZ Bar/SZ-Bar. Smith Machine is not Barbell. Muscle labels such as abs/core never select a generic exercise demo. Chinese builtin names and narrowly curated exact-motion synonyms are supported; no substring/fuzzy matching occurs.

## Available exact demonstrations

Barbell demonstrations are Bench Press, Incline Bench Press, Decline Bench Press, Bent-over Barbell Row, Squat, and Barbell Curl. Dumbbell demonstrations are Rear Delt Fly, Dumbbell Curl, Lunge, Overhead Tricep Extension, Hammer Curl, and Lateral Raise. Cable demonstrations are Lat Pulldown, Seated Cable Row, Cable Curl, and Face Pull. Tricep Dip uses parallel dip bars, and Skull Crusher uses an EZ bar. **Machine coverage is Leg Press and Leg Curl**, with the latter visibly demonstrated as a lying leg-curl machine.

The 13 wger clips belong to contributor **Goulart**. The seven FitnessScape clips were extracted from one licensed bulk demonstration, “Power Rack Training,” rather than researched separately per exercise. Its Commons page records a source-license review by Speravir on 2024-09-08, and the original YouTube page still explicitly identifies a Creative Commons Attribution release. [2] [3]

## Licenses and attribution required in the player

The **wger-derived MP4s are distributed under CC BY-SA 4.0**. Each selected video independently carries license ID 2 and `license_author: Goulart` in the public API. This is a per-media license, not wger's AGPL software license or BodyFit's MIT code license. Originals were converted from MOV/HEVC or H.264 to browser-compatible H.264 MP4, resized to at most 960 pixels wide, and had audio removed. Those changes are declared per entry. The adapted media remains available under the same CC BY-SA 4.0 terms: do not apply additional restrictions, claim exclusive ownership, or remove credit/provenance. Share-alike applies to adapted media; do not describe the clips as MIT. [1] [4]

The **FitnessScape excerpts are CC BY 3.0**. Their changes include extracting the exact chapter and converting it to silent H.264 MP4. Original-source chapter times are recorded per entry and in `power-rack-segments.json`: Lat Pulldown 69–78s; Seated Cable Row 51–56s; Decline Bench Press 91–101s; Bench Press 105–112s; Incline Bench Press 113–123s; Squat 146–156s; Bent-over Barbell Row 41–48s. Each excerpt retains the corresponding exact movement and equipment. [2] [5]

**The player must visibly show title, author, linked source, linked license, and changes.** Showing only the string “CC BY-SA 4.0” is insufficient: use the entry's `licenseUrl` as a clickable link and show `changes`. Recommended wger credit is “Rear Delt Fly — Goulart; source: wger, Bent-over Lateral Raises; CC BY-SA 4.0. Converted to H.264 MP4, resized, audio removed.” Recommended FitnessScape credit is “Lat Pulldown — FitnessScape, Power Rack Training; CC BY 3.0. Excerpt 69–78s, converted to silent MP4.” Do not imply contributor endorsement. Full original media URLs, source titles, individual video IDs, licenses, hashes, and conversion details are in `verified-manifest.json` and the shared catalog.

## Deliberately unavailable

Dumbbell Fly, Cable Crossover, Chest Press Machine, Push-up, Pec Deck, Deadlift, Pull-up, T-Bar Row, Single-arm Dumbbell Row, Hyperextension, Overhead Press, Dumbbell Shoulder Press, Front Raise, Arnold Press, Shoulder Press Machine, Preacher Curl, Concentration Curl, Tricep Pushdown, Close-grip Bench Press, Tricep Kickback, Leg Extension, Romanian Deadlift, Bulgarian Split Squat, Hip Thrust, Glute Bridge, Standing Calf Raise, Seated Calf Raise, Crunch, Plank, Cable Crunch, Hanging Leg Raise, Russian Twist, Ab Wheel Rollout, Barbell Shrug, Dumbbell Shrug, Upright Row, Wrist Curl, Reverse Curl, Farmer's Walk, Stationary Bike, Treadmill, Stair Climber, Elliptical Trainer, Rowing Machine, Ski Erg, Air Bike, and Jacob's Ladder.

Custom machine names such as MTS Decline Chest Press, Crunch Machine, Machine Lateral Raise, and Hip Adduction also return `undefined` unless their exact name/equipment is explicitly added after verification. The already-downloaded wger bulk snapshot has zero videos for Chest Press 129, Leverage Machine Chest Press 379, Leg Extension 369, and Crunches on Machine 172. Therefore none can be claimed available just because descriptions/images exist. Some additional licensed candidates were downloaded but not shipped; finishing a download is not sufficient to become an approved exact demo.

Rejected collections include hasaneyldrm/exercises-dataset, whose README specifically excludes Gym visual images/GIFs from its MIT code/data license and says users must obtain their own media license. [6] The Commons “Lat pulldown exercise demonstration.webm” and “Leg extension exercise demonstration.webm” uploads were under deletion review for lack of an original-source CC release. They were excluded despite displayed CC labels. [7] The wger “Bench Press” record's smallest clip 21 actually depicts a Smith machine and was rejected for builtin Barbell Bench Press. The RomanChairBackExtension GIF has only two still frames and was not counted as animation. [8]

## Delivery and checks

Assets, source snapshots, originals, inspection contact sheets, hashes, and provenance are stored outside the repository at `/home/ubuntu/webdev-static-assets/bodyfit-exercise-demos/`. The catalog uses **public HTTPS `files.manuscdn.com` MP4 URLs**, not local filesystem paths, API credential URLs, or an unauthenticated application storage proxy. Every shipped URL was tested on 2026-11-11 and returned **HTTP 206**, `Content-Type: video/mp4`, and valid byte-range support. `published-http-checks.json` retains those results. All 20 MP4s were decoded with ffprobe and contain hundreds of actual frames, with exact source movements visually inspected through sequential frames. Playback speed/complete normal-speed motion was not browser-reviewed by this subagent. External source/CDN outages can still occur, so the parent player's explicit load-error and no-exact-demo states remain necessary.

`manus-upload-file --webdev` was tested and returned a private `/manus-storage/...` path, but the existing Vercel rewrite does not route it to the server storage proxy. That path was therefore not shipped. No existing UI/backend/release/schema files were edited in this task.

To rerun source preparation, use `python3 scripts/source-exercise-demos.py`. This retrieves/caches explicit media IDs and validated candidates, not a fuzzy exercise search. The current allowlist for catalog generation is frozen at the 20 visually approved clips. After public upload, keep successful `upload-*.log` records in the external asset directory and run `python3 scripts/build-exercise-demo-catalog.py`, then format `shared/exerciseDemoCatalog.ts`. The builder will never add optional downloaded candidates automatically. Test with `pnpm exec vitest run server/exerciseDemoCatalog.test.ts`.

## References

[1]: https://wger.de/api/v2/exerciseinfo/?limit=1000&format=json "wger public bulk exercise records with individual video licenses"
[2]: https://commons.wikimedia.org/wiki/File:Using_a_Power_Rack_in_bodybuilding,_powerlifting,_strength_training,_resistance_exercise.webm "FitnessScape Power Rack Training and confirmed per-video CC license"
[3]: https://www.youtube.com/watch?v=45PoKV2yZ4A "FitnessScape original Power Rack Training CC release"
[4]: https://creativecommons.org/licenses/by-sa/4.0/deed.en "Creative Commons Attribution ShareAlike 4.0 terms"
[5]: https://creativecommons.org/licenses/by/3.0/ "Creative Commons Attribution 3.0 terms"
[6]: https://github.com/hasaneyldrm/exercises-dataset "Exercise dataset media license exclusion and Gym visual copyright"
[7]: https://commons.wikimedia.org/wiki/File:Lat_pulldown_exercise_demonstration.webm "Disputed lat-pulldown release and deletion request"
[8]: https://commons.wikimedia.org/wiki/File:800px-RomanChairBackExtension.gif "Two-frame still-pose GIF excluded as animation"
