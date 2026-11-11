#!/usr/bin/env python3
"""Build only the visually verified exact-motion/equipment demo catalog.

Input: source-exercise-demos.py snapshots and successful public upload logs.
Run: python3 scripts/build-exercise-demo-catalog.py
No fuzzy matching, substitutions, credentials, or application/database writes.
This is an explicit curation allowlist, NOT an automated movement classifier.
"""
from pathlib import Path
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
ASSETS = Path('/home/ubuntu/webdev-static-assets/bodyfit-exercise-demos')
# key, BodyFit canonical name, exact equipment, exact synonyms only.
CURATED = [
    ('fitnessscape-bench-press', 'Bench Press', 'Barbell', ['Barbell Bench Press']),
    ('fitnessscape-incline-bench-press', 'Incline Bench Press', 'Barbell', ['Incline Barbell Bench Press']),
    ('fitnessscape-decline-bench-press', 'Decline Bench Press', 'Barbell', ['Decline Barbell Bench Press']),
    ('fitnessscape-lat-pulldown', 'Lat Pulldown', 'Cable', ['Lat Pull Down', 'Lat Pull-down']),
    ('fitnessscape-seated-cable-row', 'Seated Cable Row', 'Cable', ['Seated Cable Rows']),
    ('fitnessscape-bent-over-barbell-row', 'Bent-over Barbell Row', 'Barbell', ['Barbell Bent-over Row']),
    ('fitnessscape-squat', 'Squat', 'Barbell', ['Barbell Squat', 'Barbell Back Squat']),
    ('wger-82-7', 'Rear Delt Fly', 'Dumbbell', ['Dumbbell Rear Delt Fly', 'Bent-over Dumbbell Fly']),
    ('wger-91-49', 'Barbell Curl', 'Barbell', ['Barbell Biceps Curl']),
    ('wger-92-48', 'Dumbbell Curl', 'Dumbbell', ['Dumbbell Biceps Curl']),
    ('wger-95-50', 'Cable Curl', 'Cable', ['Cable Biceps Curl']),
    ('wger-194-66', 'Tricep Dip', 'Dip Bar', ['Triceps Dip', 'Parallel Bar Dip']),
    ('wger-205-31', 'Lunge', 'Dumbbell', ['Dumbbell Lunge']),
    ('wger-211-57', 'Overhead Tricep Extension', 'Dumbbell', ['Overhead Triceps Extension', 'Dumbbell Overhead Triceps Extension']),
    ('wger-222-79', 'Face Pull', 'Cable', ['Facepull', 'Cable Face Pull']),
    ('wger-246-63', 'Skull Crusher', 'EZ Bar', ['EZ Bar Skull Crusher', 'EZ Bar Lying Triceps Extension']),
    ('wger-272-51', 'Hammer Curl', 'Dumbbell', ['Dumbbell Hammer Curl']),
    ('wger-348-6', 'Lateral Raise', 'Dumbbell', ['Dumbbell Lateral Raise']),
    ('wger-365-35', 'Leg Curl', 'Machine', ['Lying Leg Curl', 'Machine Leg Curl']),
    ('wger-371-44', 'Leg Press', 'Machine', ['Machine Leg Press']),
]


def main():
    uploaded = {}
    for file in sorted(ASSETS.glob('upload-*.log')):
        for path, url in re.findall(r'\[SUCCESS\] (\S+) -> (https://\S+)', file.read_text()):
            uploaded[Path(path).stem] = url
    wger = {e['id']: e for e in json.loads((ASSETS / 'wger-exerciseinfo.json').read_text())['results']}
    licenses = {e['id']: e for e in json.loads((ASSETS / 'wger-license.json').read_text())['results']}
    commons = {}
    for file in ASSETS.glob('commons-*.json'):
        data = json.loads(file.read_text())
        for page in data.get('query', {}).get('pages', {}).values():
            title = page['title'].removeprefix('File:')
            slug = re.sub(r'[^a-z0-9]+', '-', title.rsplit('.', 1)[0].lower()).strip('-')
            commons['commons-' + slug] = page['imageinfo'][0]
    segments = json.loads((ASSETS / 'power-rack-segments.json').read_text())
    result = []
    selected_names = set()
    manifest = []
    builtins = json.loads((ASSETS / 'bodyfit-builtin-exercises.json').read_text())
    by_name = {e['name']: e for e in builtins}
    for key, name, equipment, aliases in CURATED:
        if key not in uploaded or name in selected_names:
            continue
        file = ASSETS / (key + '.mp4')
        if not file.exists():
            raise RuntimeError(f'Missing published file {key}')
        probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,nb_read_frames:format=duration', '-of', 'json', str(file)]))
        if probe['streams'][0]['codec_name'] != 'h264' or int(probe['streams'][0]['nb_read_frames']) < 10:
            raise RuntimeError(f'Invalid animated browser media {key}')
        entry = {'name': name, 'equipment': equipment, 'aliases': aliases + [by_name[name]['nameZh']], 'url': uploaded[key], 'kind': 'video'}
        if key.startswith('wger-'):
            _, exercise_id, video_id = key.split('-')
            exercise = wger[int(exercise_id)]
            video = next(v for v in exercise['videos'] if v['id'] == int(video_id))
            lic = licenses[video['license']]
            if video['exercise'] != int(exercise_id) or video['license'] not in [1, 2, 4] or not video['license_author']:
                raise RuntimeError(f'No per-media CC license {key}')
            source_title = next(t['name'] for t in exercise['translations'] if t['language'] == 2)
            entry.update({'sourceUrl': f'https://wger.de/api/v2/exerciseinfo/{exercise_id}/', 'license': lic['short_name'].replace('CC-BY-SA 4', 'CC BY-SA 4.0'), 'licenseUrl': lic['url'], 'author': video['license_author'], 'sourceTitle': source_title, 'originalUrl': video['video']})
            changes = 'Converted to H.264 MP4; resized to at most 960px wide; audio removed.'
            provenance = {'exerciseId': int(exercise_id), 'videoId': int(video_id), 'perMediaLicenseId': video['license'], 'mediaRecord': video}
        elif key.startswith('fitnessscape-'):
            source = commons['commons-using-a-power-rack-in-bodybuilding-powerlifting-strength-training-resistance-exercise']
            start, duration = segments[key.removeprefix('fitnessscape-')]
            entry.update({'sourceUrl': source['descriptionurl'], 'license': 'CC BY 3.0', 'licenseUrl': 'https://creativecommons.org/licenses/by/3.0/', 'author': 'FitnessScape', 'sourceTitle': 'Power Rack Training', 'originalUrl': source['url'].split('?')[0]})
            changes = f'Excerpt {start}–{start + duration}s; converted to silent H.264 MP4. Same exact movement and equipment.'
            provenance = {'startSeconds': start, 'durationSeconds': duration, 'originalSourceUrl': 'https://www.youtube.com/watch?v=45PoKV2yZ4A', 'licenseReview': 'Commons review by Speravir, 2024-09-08; current YouTube CC release verified 2026-11-11'}
        else:
            source = commons[key]
            meta = source['extmetadata']
            value = lambda k: meta.get(k, {}).get('value', '')
            if 'deletion requests' in value('Categories').lower():
                raise RuntimeError(f'Disputed license {key}')
            entry.update({'sourceUrl': source['descriptionurl'], 'license': value('LicenseShortName'), 'licenseUrl': value('LicenseUrl'), 'author': re.sub(r'<[^>]+>', '', value('Artist')), 'sourceTitle': value('ObjectName'), 'originalUrl': source['url'].split('?')[0]})
            changes = 'Original continuous animation converted to silent H.264 MP4.'
            provenance = {'sourceMetadata': source}
        entry.update({'title': name, 'changes': changes, 'verifiedAt': '2026-11-11', 'muscleGroup': 'core' if by_name[name]['muscleGroup'] in ['abs', 'core'] else by_name[name]['muscleGroup']})
        selected_names.add(name)
        result.append(entry)
        manifest.append({**entry, **provenance, 'localFile': str(file), 'sha256': hashlib.sha256(file.read_bytes()).hexdigest(), 'probe': probe})
    official_source = (ROOT / 'shared/officialMachineDemos.ts').read_text()
    official_names = set(re.findall(r"name: '([^']+)', equipment: 'Machine'", official_source))
    available_builtin = selected_names | (official_names & set(by_name))
    missing = [e['name'] for e in builtins if e['name'] not in available_builtin]
    header = '''/** Exact motion/equipment demos, curated 2026-11-11. No fuzzy fallback.
 * Source media licenses are independent of this repository's MIT code license.
 * Display title/author/license plus source link AND licenseUrl/changes in attribution.
 * See /home/ubuntu/webdev-static-assets/bodyfit-exercise-demos/README.md.
 */
import { officialMachineDemos } from './officialMachineDemos';
export interface ExerciseDemo {
  url: string;
  kind: "video" | "gif" | "youtube";
  videoId?: string;
  sourceUrl: string;
  license: string;
  author: string;
  title: string;
  posterUrl?: string;
  licenseUrl?: string;
  changes?: string;
}
export interface ExerciseDemoCatalogEntry extends ExerciseDemo {
  name: string;
  equipment: string;
  aliases: readonly string[];
  sourceTitle: string;
  originalUrl: string;
  verifiedAt: string;
  muscleGroup: string;
}
'''
    footer = '''
export const EXERCISE_DEMO_CATALOG = exerciseDemoCatalog;
function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/[‐‑–—]/g, "-").replace(/\\s+/g, " ");
}
const equipmentAliases: Record<string, string> = {
  "cable machine": "cable", "sz-bar": "ez bar", "ez-bar": "ez bar",
  "body weight": "bodyweight", "pull up bar": "pull-up bar", "parallel bars": "dip bar",
};
function normalizeEquipment(value: string): string {
  const key = normalize(value);
  return equipmentAliases[key] ?? key;
}
/** Only exact canonical names or curated movement synonyms; unknown/mismatch -> undefined.
 * A muscle-group label (including abs/core) is never treated as an exercise name.
 * Generic names default to the builtin equipment only when no equipment is provided.
 */
export function getExerciseDemo(name: string, equipment?: string): ExerciseDemo | undefined {
  const key = normalize(name);
  const matches = exerciseDemoCatalog.filter(entry =>
    [entry.name, ...entry.aliases].some(alias => normalize(alias) === key));
  const matching = equipment?.trim()
    ? matches.filter(entry => normalizeEquipment(entry.equipment) === normalizeEquipment(equipment))
    : matches;
  return matching.length === 1 ? matching[0] : undefined;
}
'''
    content = header + 'const curatedNativeDemos: readonly ExerciseDemoCatalogEntry[] = ' + json.dumps(result, ensure_ascii=False, indent=2) + ';\n'
    content += 'export const exerciseDemoCatalog: readonly ExerciseDemoCatalogEntry[] = [...curatedNativeDemos, ...officialMachineDemos];\n'
    content += 'export const unavailableExerciseDemoNames: readonly string[] = ' + json.dumps(missing, ensure_ascii=False, indent=2) + ';\n'
    content += f'export const exerciseDemoCoverage = {{ verified: {len(available_builtin)}, customOnly: {len(official_names - set(by_name))}, shipped: {len(result) + len(official_names)}, nativeVideos: {len(result)}, officialEmbeds: {len(official_names)}, unavailable: {len(missing)}, builtinTotal: {len(builtins)}, checkedAt: "2026-11-11" }} as const;\n' + footer
    (ROOT / 'shared/exerciseDemoCatalog.ts').write_text(content)
    (ASSETS / 'verified-manifest.json').write_text(json.dumps({'coverage': {'verified': len(available_builtin), 'nativeVideos': len(result), 'officialEmbeds': len(official_names), 'unavailable': len(missing), 'builtinTotal': len(builtins)}, 'demos': manifest, 'officialSource': 'shared/officialMachineDemos.ts', 'unavailableNames': missing}, ensure_ascii=False, indent=2) + '\n')
    print(f'Catalog: {len(available_builtin)}/{len(builtins)} builtin demos; {len(result)} native + {len(official_names)} official; {len(missing)} explicitly unavailable')


if __name__ == '__main__':
    main()
