#!/usr/bin/env python3
"""Fetch licensed exercise demo candidates, validate actual motion, and export MP4.

No credentials, application writes, paid generation, or fuzzy exercise matching.
Source snapshots/media/manifest live outside the repository. Run from any cwd:
  python3 scripts/source-exercise-demos.py
Requires requests, Pillow, ffmpeg, ffprobe. Never infer a media license from code.
The checked-in catalog is deliberately curated after visual inspection; this script
only downloads explicit IDs/titles, never silently replaces them with a search hit.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import re
import subprocess
import time
import requests

ROOT = Path(__file__).resolve().parents[1]
ASSETS = Path('/home/ubuntu/webdev-static-assets/bodyfit-exercise-demos')
WGER_IDS = [82, 91, 92, 95, 194, 205, 211, 222, 246, 272, 294, 348,
            365, 371, 465, 475, 507, 512, 538, 543, 567, 590, 622, 655, 659]
COMMONS_TITLES = [
    'File:Using a Power Rack in bodybuilding, powerlifting, strength training, resistance exercise.webm',
    'File:Squat - exercise demonstration video.webm',
    'File:Deadlift - exercise demonstration video.webm',
    'File:Bent-over row - exercise demonstration video.webm',
    'File:Shoulder press - exercise demonstration video.webm',
    'File:Leg raises - exercise demonstration video.webm',
    'File:Pushups.gif',
    'File:Man on a Treadmill GIF Animation Loop.gif',
    'File:Man on an Exercise Bike GIF Animation Loop.gif',
]


def fetch(url, **kwargs):
    for attempt in range(4):
        try:
            response = requests.get(url, headers={'User-Agent': 'BodyFitDemoCatalog/1.0 contact https://wger.de'}, timeout=180, **kwargs)
            response.raise_for_status()
            return response
        except requests.RequestException:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)


def snapshot(endpoint):
    file = ASSETS / f'wger-{endpoint}.json'
    if file.exists():
        return json.loads(file.read_text())
    url = f'https://wger.de/api/v2/{endpoint}/?limit=1000&format=json'
    data = fetch(url).json()
    if data.get('next'):
        raise RuntimeError('Bulk dataset exceeded limit: explicitly paginate before proceeding')
    file.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    return data


def commons_candidates():
    pages = {}
    for file in ASSETS.glob('commons-*.json'):
        data = json.loads(file.read_text())
        pages.update({p['title']: p for p in data.get('query', {}).get('pages', {}).values()})
    missing = [title for title in COMMONS_TITLES if title not in pages]
    if missing:
        data = fetch('https://commons.wikimedia.org/w/api.php', params={
            'action': 'query', 'format': 'json', 'titles': '|'.join(missing),
            'prop': 'imageinfo', 'iiprop': 'url|mime|size|extmetadata',
        }).json()
        (ASSETS / 'commons-selected.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        pages.update({p['title']: p for p in data.get('query', {}).get('pages', {}).values()})
    candidates = []
    for title in COMMONS_TITLES:
        page = pages[title]
        media = page['imageinfo'][0]
        meta = media['extmetadata']
        value = lambda key: meta.get(key, {}).get('value', '')
        categories = value('Categories').lower()
        if any(term in categories for term in ['deletion requests', 'copyright violation', 'license review failed']):
            raise RuntimeError(f'Disputed Commons media: {title}')
        license_name = value('LicenseShortName')
        if license_name not in ['CC BY-SA 4.0', 'CC BY-SA 3.0', 'CC BY 3.0', 'Public domain']:
            raise RuntimeError(f'Unapproved Commons media license: {title}: {license_name}')
        slug = re.sub(r'[^a-z0-9]+', '-', title.removeprefix('File:').rsplit('.', 1)[0].lower()).strip('-')
        candidates.append({
            'key': f'commons-{slug}', 'title': title.removeprefix('File:'),
            'originalUrl': media['url'].split('?')[0], 'sourceUrl': media['descriptionurl'],
            'license': license_name, 'licenseUrl': value('LicenseUrl'),
            'author': re.sub(r'<[^>]+>', '', value('Artist')), 'sourceMetadata': media,
        })
    return candidates


def candidates():
    licenses = {l['id']: l for l in snapshot('license')['results']}
    exercises = {e['id']: e for e in snapshot('exerciseinfo')['results']}
    result = []
    for id in WGER_IDS:
        exercise = exercises[id]
        translation = next(t for t in exercise['translations'] if t['language'] == 2)
        videos = sorted(exercise['videos'], key=lambda v: (not v['is_main'], v['size'], v['id']))
        video = videos[0]
        license = licenses[video['license']]
        if video['exercise'] != id or video['license'] not in [1, 2, 3, 4] or not video['license_author']:
            raise RuntimeError(f'Missing explicit media attribution or unsupported license: {id}')
        result.append({
            'key': f'wger-{id}-{video["id"]}', 'exerciseId': id, 'videoId': video['id'],
            'title': translation['name'], 'originalUrl': video['video'],
            'sourceUrl': f'https://wger.de/api/v2/exerciseinfo/{id}/',
            'license': license['short_name'], 'licenseUrl': license['url'],
            'author': video['license_author'], 'sourceMetadata': video,
            'equipment': exercise['equipment'], 'description': translation['description'],
        })
    return result + commons_candidates()


def run(command):
    return subprocess.check_output(command, stderr=subprocess.PIPE)


def process(item):
    extension = '.' + item['originalUrl'].rsplit('.', 1)[1].lower()
    source = ASSETS / 'originals' / (item['key'] + extension)
    response_meta = ASSETS / 'originals' / (item['key'] + '.http.json')
    if not source.exists():
        response = fetch(item['originalUrl'])
        source.write_bytes(response.content)
        response_meta.write_text(json.dumps({
            'url': response.url, 'status': response.status_code,
            'contentType': response.headers.get('Content-Type'), 'bytes': len(response.content),
            'testedAt': datetime.now(timezone.utc).isoformat(),
        }, indent=2) + '\n')
    if extension == '.gif':
        from PIL import Image
        with Image.open(source) as image:
            if getattr(image, 'n_frames', 1) < 10:
                raise RuntimeError(f'Not genuine continuous animation: {item["key"]}')
    target = ASSETS / (item['key'] + '.mp4')
    if not target.exists():
        run(['ffmpeg', '-v', 'error', '-y', '-i', str(source), '-map', '0:v:0',
             '-vf', r'scale=trunc(min(960\,iw)/2)*2:-2', '-an', '-c:v', 'libx264',
             '-threads', '2', '-preset', 'fast', '-crf', '24', '-pix_fmt', 'yuv420p',
             '-movflags', '+faststart', str(target)])
    probe = json.loads(run(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
                           '-count_frames', '-show_entries', 'stream=codec_name,width,height,nb_read_frames,duration:format=duration',
                           '-of', 'json', str(target)]))
    stream = probe['streams'][0]
    frame_count = int(stream['nb_read_frames'])
    if frame_count < 10 or float(probe['format']['duration']) <= 0:
        raise RuntimeError(f'Not actual animated media: {item["key"]}')
    # Inspect ten sequential frames visually; these are QA artifacts, not shipped still demos.
    sheet = ASSETS / 'inspection' / (item['key'] + '.jpg')
    duration = float(probe['format']['duration'])
    run(['ffmpeg', '-v', 'error', '-y', '-i', str(target), '-vf',
         f'fps=10/{duration},scale=320:-1,tile=5x2', '-frames:v', '1', str(sheet)])
    return {**item, 'localFile': str(target), 'sourceFile': str(source),
            'http': json.loads(response_meta.read_text()), 'probe': probe,
            'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
            'changes': 'Converted to H.264 MP4, resized to at most 960px wide; audio removed. No movement substitution.',
            'inspectionFile': str(sheet)}


def main():
    for directory in [ASSETS, ASSETS / 'originals', ASSETS / 'inspection']:
        directory.mkdir(parents=True, exist_ok=True)
    result = []
    failed = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(process, item): item for item in candidates()}
        for future in as_completed(futures):
            item = futures[future]
            try:
                verified = future.result()
                result.append(verified)
                print(f'Validated {item["key"]}: {verified["probe"]["streams"][0]["nb_read_frames"]} real frames', flush=True)
            except Exception as error:
                failed.append({'key': item['key'], 'error': str(error)})
                print(f'FAILED {item["key"]}: {error}', flush=True)
    (ASSETS / 'candidate-manifest.json').write_text(json.dumps({
        'testedAt': datetime.now(timezone.utc).isoformat(),
        'candidates': sorted(result, key=lambda i: i['key']), 'failed': failed,
    }, ensure_ascii=False, indent=2) + '\n')
    if failed:
        raise SystemExit(f'{len(failed)} downloads failed; never ship them as verified')


if __name__ == '__main__':
    main()
