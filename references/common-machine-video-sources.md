# Common machine video sources

**Four exact machine demonstrations are ready for the YouTube embed type.** Three are from Life FitnessTraining and one is from Matrix Fitness. The structured handoff is `/home/ubuntu/bodyfit-common-machine-videos.json`. Verification date: 11 November 2026. Author: Manus AI.

## Chest Press Machine

Use **Insignia Series Chest Press**, video ID `VLDg23FqQM0`, by **Life FitnessTraining**. The public video page and YouTube oEmbed response agree on the exact title and author. URL-based video analysis confirmed a seated, selectorized chest press with forward, slightly converging handle movement and elbow extension; repetitions are approximately 00:19–00:36. It is not the newer Dual Axis Chest Press combination, a pec fly, or a freeweight exercise. [1] [7]

Embed: `https://www.youtube-nocookie.com/embed/VLDg23FqQM0`.

## Abdominal Crunch — Machine

Use **Insignia Series Abdominal Crunch**, video ID `o_0WrejFbAw`, by **Life FitnessTraining**. URL-based video analysis confirmed a seated resistance-machine crunch using a padded upper-body harness and weight stack. The user flexes forward and returns upright; repetitions are approximately 00:10–00:26. No floor crunch or bench sit-up appears. [2] [8]

Embed: `https://www.youtube-nocookie.com/embed/o_0WrejFbAw`.

## Pec Deck / Pectoral Fly — Machine

Use **Aura Series | Pectoral Fly | Setup & Movements | Matrix Fitness**, video ID `N-DAB49l-cA`, by **Matrix Fitness**. The manufacturer video description explicitly instructs the user to rest the forearms on pads, choose the starting position and push the arms together. URL-based video analysis confirmed a seated pec-deck machine with vertical grips and forearm pads, performing inward horizontal adduction from approximately 00:47. No reverse/rear-deltoid fly is shown. This padded-arm, fly-only demonstration avoids ambiguity with Life Fitness's combined Pectoral Fly/Rear Deltoid title. [3] [9]

Embed: `https://www.youtube-nocookie.com/embed/N-DAB49l-cA`.

## Leg Extension — Machine

Use **Insignia Series Leg Extension**, video ID `ZyWFzGyFwK0`, by **Life FitnessTraining**. URL-based video analysis confirmed seated knee extension on a selectorized machine with the padded roller against the front of the ankles/lower shins, approximately 00:15–00:30. This is neither a seated leg curl nor a leg press. [4] [10]

Embed: `https://www.youtube-nocookie.com/embed/ZyWFzGyFwK0`.

## Official-channel and embedding evidence

The Life FitnessTraining channel identifies Life Fitness Academy as the manufacturer's global Training and Education wing and links to `lifefitness.com/lfa`. It also links the main Life Fitness / Hammer Strength and Hammer Strength channels. MatrixFitnessGlobal describes the Matrix manufacturer brand, links to `matrixfitness.com`, and exposes its manufacturer learning-center playlists. The pec-fly video's own description also directs viewers to the Matrix manufacturer website. These are manufacturer training uploads, not third-party reuploads. [5] [6] [3]

All four public YouTube oEmbed endpoints returned **HTTP 200**, `type: video`, the listed title and author, and provider-generated iframe HTML pointing to `https://www.youtube.com/embed/VIDEO_ID?feature=oembed`. This is concrete evidence that YouTube supplies an embed for each exact source ID; it is stronger than constructing an untested ID from a search snippet. The abdominal-crunch and Matrix pec-fly privacy-enhanced embed pages additionally returned HTTP 200. [7] [8] [9] [10]

**Remaining gap: browser playback was not tested.** No shared browser was used. Public sandbox watch-page requests for the abdominal-crunch and leg-extension videos returned YouTube's anti-bot `LOGIN_REQUIRED` response. The fetch-rendered Matrix page contained a generic temporary-unavailability message, although its metadata, oEmbed and URL-based video analysis succeeded. No explicit `isEmbedAllowed` flag was available. Therefore the handoff records provider-supported embeds, not a guarantee of playback for every region or user. The parent should verify the iframe in its own application and retain an “Open on YouTube” fallback.

All four movements have content verification; there is no missing-motion gap. Video-analysis timestamps are approximate AI observations, not frame-accurate timings. The canonical iframe URLs intentionally contain no start/end parameters.

The implementation must keep `kind: "youtube"` distinct from the existing MP4 catalog. These sources do not add four MP4 files to the existing twenty-file count. Use the provider's official iframe rather than downloading, copying, transcoding or rehosting YouTube media. No YouTube media file was downloaded. No claim of a Creative Commons or redistributable video license is made. Machine-only aliases are included; do not map these sources to floor crunches, dumbbell flies, or other equipment.

Only the new JSON and this new report are delivered. Existing application files, database, health data, commits and checkpoints were not changed, and the previously failed wger lookup was not repeated.

## References

[1]: https://www.youtube.com/watch?v=VLDg23FqQM0 "Life FitnessTraining — Insignia Series Chest Press"
[2]: https://www.youtube.com/watch?v=o_0WrejFbAw "Life FitnessTraining — Insignia Series Abdominal Crunch"
[3]: https://www.youtube.com/watch?v=N-DAB49l-cA "Matrix Fitness — Aura Series Pectoral Fly setup and movements"
[4]: https://www.youtube.com/watch?v=ZyWFzGyFwK0 "Life FitnessTraining — Insignia Series Leg Extension"
[5]: https://www.youtube.com/@LifeFitnessTraining "Official Life Fitness Academy training channel and manufacturer links"
[6]: https://www.youtube.com/@MatrixFitnessGlobal "Official Matrix Fitness global channel and learning-center playlists"
[7]: https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DVLDg23FqQM0&format=json "YouTube oEmbed metadata and iframe — Chest Press"
[8]: https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Do_0WrejFbAw&format=json "YouTube oEmbed metadata and iframe — Abdominal Crunch"
[9]: https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DN-DAB49l-cA&format=json "YouTube oEmbed metadata and iframe — Pectoral Fly"
[10]: https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DZyWFzGyFwK0&format=json "YouTube oEmbed metadata and iframe — Leg Extension"

## Application runtime follow-up — 2026年11月11日（香港）

The parent integrated all four sources as `kind: "youtube"` with exact Machine matching and no rehosting. A real BodyFit preview browser loaded the Chest Press privacy-enhanced iframe, received YouTube's ready callback and advertised playback rates, and displayed the correct manufacturer/title and poster. A genuine click on the iframe's Play control was attempted. Native SDK inspection reported state 3 (buffering), 0 seconds, a 41-second duration and zero media loaded; actual playback was not verified in this cloud environment. The implementation therefore bounds both API initialization and media buffering at 20 seconds and keeps a working official-source link/retry, rather than claiming that SDK ready proves playable motion. Unit DOM tests separately verify controls, errors, half speed, retry and teardown using a mocked API; those tests are not runtime playback evidence for all regions. The three remaining runtime streams have content/oEmbed verification only, not live playback confirmation.

The adapter uses the established MIT [youtube-player library](https://github.com/gajus/youtube-player) to receive official ready/error/state/rate events, without custom undocumented postMessage control. Its code license does not license the manufacturer videos for copying. The public player is activated only on request, embeds the current BodyFit origin with a strict-origin-when-cross-origin referrer, and does not auto-play.
