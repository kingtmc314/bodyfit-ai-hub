import type { ExerciseDemoCatalogEntry } from './exerciseDemoCatalog';
/** Provider-embedded machine motion demonstrations; not licensed for copying or rehosting.
 * Content verified from manufacturer metadata and video analysis. Native runtime may depend on region/browser.
 * Motion evidence and provider oEmbed responses: references/common-machine-video-sources.md.
 * Playback adapter: https://github.com/gajus/youtube-player (MIT); independent of video copyright.
 */
const terms = 'https://www.youtube.com/t/terms';
const changes = '官方 YouTube 嵌入；影片保持原作內容，不下載、剪輯或重新發布。';
export const officialMachineDemos: readonly ExerciseDemoCatalogEntry[] = [
  {
    name: 'Chest Press Machine', equipment: 'Machine', aliases: ['Chest Press (machine)', 'Chest Press(machine)', 'Machine Chest Press', '胸推機'],
    kind: 'youtube', videoId: 'VLDg23FqQM0', url: 'https://www.youtube-nocookie.com/embed/VLDg23FqQM0',
    sourceUrl: 'https://www.youtube.com/watch?v=VLDg23FqQM0', originalUrl: 'https://www.youtube.com/watch?v=VLDg23FqQM0',
    author: 'Life FitnessTraining', title: 'Chest Press Machine', sourceTitle: 'Insignia Series Chest Press',
    license: '官方嵌入 · 版權屬原作者', licenseUrl: terms, changes, verifiedAt: '2026-11-11', muscleGroup: 'chest',
  },
  {
    name: 'Abdominal Crunch', equipment: 'Machine', aliases: ['Abdominal Crunch (machine)', 'Abdominal Crunch(machine)', 'Machine Abdominal Crunch', 'Ab Crunch Machine', '腹肌捲腹機'],
    kind: 'youtube', videoId: 'o_0WrejFbAw', url: 'https://www.youtube-nocookie.com/embed/o_0WrejFbAw',
    sourceUrl: 'https://www.youtube.com/watch?v=o_0WrejFbAw', originalUrl: 'https://www.youtube.com/watch?v=o_0WrejFbAw',
    author: 'Life FitnessTraining', title: 'Abdominal Crunch', sourceTitle: 'Insignia Series Abdominal Crunch',
    license: '官方嵌入 · 版權屬原作者', licenseUrl: terms, changes, verifiedAt: '2026-11-11', muscleGroup: 'abs',
  },
  {
    name: 'Pec Deck', equipment: 'Machine', aliases: ['Pec Deck Machine', 'Pectoral Fly', 'Pec Deck (machine)', 'Pec Deck(machine)', 'Pectoral Fly (machine)', 'Pectoral Fly(machine)', 'Machine Pectoral Fly', '蝴蝶機夾胸'],
    kind: 'youtube', videoId: 'N-DAB49l-cA', url: 'https://www.youtube-nocookie.com/embed/N-DAB49l-cA',
    sourceUrl: 'https://www.youtube.com/watch?v=N-DAB49l-cA', originalUrl: 'https://www.youtube.com/watch?v=N-DAB49l-cA',
    author: 'Matrix Fitness', title: 'Pec Deck', sourceTitle: 'Aura Series | Pectoral Fly | Setup & Movements | Matrix Fitness',
    license: '官方嵌入 · 版權屬原作者', licenseUrl: terms, changes, verifiedAt: '2026-11-11', muscleGroup: 'chest',
  },
  {
    name: 'Leg Extension', equipment: 'Machine', aliases: ['Leg Extension (machine)', 'Leg Extension(machine)', 'Machine Leg Extension', '腿伸展機'],
    kind: 'youtube', videoId: 'ZyWFzGyFwK0', url: 'https://www.youtube-nocookie.com/embed/ZyWFzGyFwK0',
    sourceUrl: 'https://www.youtube.com/watch?v=ZyWFzGyFwK0', originalUrl: 'https://www.youtube.com/watch?v=ZyWFzGyFwK0',
    author: 'Life FitnessTraining', title: 'Leg Extension', sourceTitle: 'Insignia Series Leg Extension',
    license: '官方嵌入 · 版權屬原作者', licenseUrl: terms, changes, verifiedAt: '2026-11-11', muscleGroup: 'quads',
  },
];
