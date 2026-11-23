#!/usr/bin/env python3
"""Pack a finished explainroo video for the iamyogeshmalkani/what-if-videos repo and publish it.

  python3 scripts/whatif-pack.py <slug> [--frame SECONDS] [--meta FILE] [--repo DIR] [--no-push]

Needs: videos/<slug>/out/video.mp4 (+ .srt .vtt) from `render`, a metadata JSON (title, description, tags, hashtags, pinnedComment,
thumbnail.lines, frame), a local clone of the repo (default /tmp/wiv) and `gh` logged in. It makes the thumbnail, captions, youtube.txt,
metadata.json, the bundle and source zips, uploads the three release files to tag `videos`, adds the entry to data/videos.json, updates the
README count, commits and pushes. The voice reference (assets/voice-ref.wav) is never put in the source zip.
"""
import argparse, json, os, re, shutil, subprocess, sys, zipfile
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FFMPEG = os.environ.get('EXPLAINROO_FFMPEG', 'ffmpeg')
FFPROBE = os.environ.get('EXPLAINROO_FFPROBE', 'ffprobe')
FONT = '/System/Library/Fonts/Supplemental/Impact.ttf'
REPO_NAME = 'iamyogeshmalkani/what-if-videos'
TAG = 'videos'


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode:
        sys.exit(f'FAILED: {" ".join(cmd)}\n{r.stdout}\n{r.stderr}')
    return r.stdout


def thumbnail(video, frame, lines, out, y0=70, smax=190):
    tmp = out + '.frame.png'
    run([FFMPEG, '-y', '-loglevel', 'error', '-ss', str(frame), '-i', video, '-frames:v', '1', tmp])
    im = Image.open(tmp).convert('RGB').resize((1080, 1920))
    os.remove(tmp)
    # darken the top so the lettering reads
    over = Image.new('RGBA', im.size, (0, 0, 0, 0)); d0 = ImageDraw.Draw(over)
    for y in range(0, 760):
        d0.line([(0, y), (1080, y)], fill=(0, 0, 0, int(150 * (1 - y / 760))))
    im = Image.alpha_composite(im.convert('RGBA'), over).convert('RGB')
    d = ImageDraw.Draw(im)
    y = y0
    for i, raw in enumerate(lines):
        hot = raw.startswith('*') and raw.endswith('*'); text = raw.strip('*')
        size = smax
        while size > 40:
            f = ImageFont.truetype(FONT, size)
            if d.textlength(text, font=f) <= 960: break
            size -= 4
        w = d.textlength(text, font=f)
        col = '#ff5a36' if hot else ('#ffd23f' if i == 0 else '#ffffff')
        d.text(((1080 - w) / 2, y), text, font=f, fill=col, stroke_width=12, stroke_fill='#1a1006')
        y += int(size * 1.12)
    im.save(out, 'JPEG', quality=88)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('slug'); ap.add_argument('--frame', type=float); ap.add_argument('--meta')
    ap.add_argument('--repo', default='/tmp/wiv'); ap.add_argument('--no-push', action='store_true')
    ap.add_argument('--as', dest='name', help='name of the video in the repo (default: the local folder name)')
    a = ap.parse_args()
    vdir = os.path.join(ROOT, 'videos', a.slug); out = os.path.join(vdir, 'out')
    local = a.slug; a.slug = a.name or a.slug  # from here on a.slug is the name in the repo; `local` is the project folder
    mp4 = os.path.join(out, 'video.mp4')
    if not os.path.exists(mp4): sys.exit('no rendered video: ' + mp4)
    meta = json.load(open(a.meta or f'/tmp/ana/meta/{a.slug}.json'))
    frame = a.frame if a.frame is not None else meta.get('frame', 5)

    # the repo folder is a scratch clone used only by this script: start from the remote state (drops any half-finished earlier run)
    run(['git', '-C', a.repo, 'fetch', '-q', 'origin', 'main'])
    run(['git', '-C', a.repo, 'reset', '-q', '--hard', 'origin/main'])
    pdir = os.path.join(a.repo, 'videos', a.slug); os.makedirs(pdir, exist_ok=True)
    thumbnail(mp4, frame, meta['thumbnail']['lines'], os.path.join(pdir, 'thumbnail.jpg'), meta['thumbnail'].get('y', 70), meta['thumbnail'].get('size', 190))
    shutil.copy(os.path.join(out, 'video.srt'), os.path.join(pdir, 'captions.srt'))
    shutil.copy(os.path.join(out, 'video.vtt'), os.path.join(pdir, 'captions.vtt'))
    md = {k: meta[k] for k in ('title', 'language', 'category', 'description', 'tags', 'hashtags', 'pinnedComment', 'thumbnail')}
    json.dump(md, open(os.path.join(pdir, 'metadata.json'), 'w'), ensure_ascii=False, indent=2)
    txt = f"TITLE\n{meta['title']}\n\nDESCRIPTION\n{meta['description']}\n\nTAGS\n{', '.join(meta['tags'])}\n\nPINNED COMMENT\n{meta['pinnedComment']}\n"
    open(os.path.join(pdir, 'youtube.txt'), 'w').write(txt)

    # release files
    rel = os.path.join('/tmp/ana/release', a.slug); os.makedirs(rel, exist_ok=True)
    f_mp4 = os.path.join(rel, a.slug + '.mp4'); shutil.copy(mp4, f_mp4)
    f_zip = os.path.join(rel, a.slug + '.zip')
    with zipfile.ZipFile(f_zip, 'w', zipfile.ZIP_DEFLATED) as z:
        z.write(mp4, a.slug + '.mp4')
        for n in ('thumbnail.jpg', 'captions.srt', 'captions.vtt', 'youtube.txt'): z.write(os.path.join(pdir, n), n)
    f_src = os.path.join(rel, a.slug + '-source.zip')
    with zipfile.ZipFile(f_src, 'w', zipfile.ZIP_DEFLATED) as z:
        for n in ('script.md', 'scenes.js', 'shots.js', 'video.json', 'look.json'):
            if os.path.exists(os.path.join(vdir, n)): z.write(os.path.join(vdir, n), n)
        for sub in ('lib', 'data'):
            for dp, _, fs in os.walk(os.path.join(vdir, sub)):
                for f in fs: z.write(os.path.join(dp, f), os.path.relpath(os.path.join(dp, f), vdir))
        for n in ('basemap.jpg', 'ATTRIBUTION.md'):
            p = os.path.join(vdir, 'assets', n)
            if os.path.exists(p): z.write(p, 'assets/' + n)
        # cartoon template videos: the pictures (shotNN, char-*) and the font; never a voice recording
        for dp, _, fs in os.walk(os.path.join(vdir, 'assets')):
            for f in fs:
                if re.match(r'^(shot\d+|char-.*)\.(jpg|png|webp)$', f) or f.endswith(('.woff2', '.txt')) and 'fonts' in dp:
                    z.write(os.path.join(dp, f), os.path.relpath(os.path.join(dp, f), vdir))
        z.writestr('REBUILD.md', 'Made with explainroo (what-if-map template). Put a voice sample in assets/voice-ref.wav (or change "voice" in video.json), then:\n'
                   '  node bin/explainroo.js voice <folder> && node bin/explainroo.js render <folder>\nThe original voice sample is not included.\n')

    # duration / size of the video
    probe = json.loads(run([FFPROBE, '-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', mp4]))
    vs = next(s for s in probe['streams'] if s['codec_type'] == 'video')
    dur = round(float(probe['format']['duration']), 2)

    # upload first: if it fails nothing is pushed
    run(['gh', 'release', 'upload', TAG, f_mp4, f_zip, f_src, '-R', REPO_NAME, '--clobber'])

    dp = os.path.join(a.repo, 'data', 'videos.json'); data = json.load(open(dp))
    entry = dict(slug=a.slug, title=meta['title'], language=meta['language'], category=meta['category'], duration=dur, width=vs['width'], height=vs['height'],
                 bytes=os.path.getsize(mp4), description=meta['description'], tags=meta['tags'], hashtags=meta['hashtags'], pinnedComment=meta['pinnedComment'],
                 thumbnail=f'videos/{a.slug}/thumbnail.jpg', srt=f'videos/{a.slug}/captions.srt', vtt=f'videos/{a.slug}/captions.vtt', txt=f'videos/{a.slug}/youtube.txt',
                 files=dict(video=a.slug + '.mp4', bundle=a.slug + '.zip', source=a.slug + '-source.zip'))
    data['videos'] = [v for v in data['videos'] if v['slug'] != a.slug] + [entry]
    import datetime
    data['updated'] = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.000Z')
    json.dump(data, open(dp, 'w'), ensure_ascii=False, indent=2)

    rp = os.path.join(a.repo, 'README.md'); rd = open(rp).read()
    m = re.search(r'^(\d+) short videos \((\d+) "What if\.\.\.\?" map videos, (\d+) "What if\.\.\.\?" low-poly island films and (\d+) educational explainers\)', rd, re.M)
    if m:
        total, mapv, isl, exp = map(int, m.groups())
        n_total = len(data['videos'])
        if n_total != total:
            added = n_total - total
            if a.slug.startswith('what-if-'): mapv += added
            else: exp += added
            rd = rd.replace(m.group(0), f'{n_total} short videos ({mapv} "What if...?" map videos, {isl} "What if...?" low-poly island films and {exp} educational explainers)', 1)
            open(rp, 'w').write(rd)

    if a.no_push:
        print('packed (not pushed):', a.slug); return
    run(['git', '-C', a.repo, 'add', f'videos/{a.slug}', 'data/videos.json', 'README.md'])
    run(['git', '-C', a.repo, 'commit', '-q', '-m', f'Add {a.slug}\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'])
    run(['git', '-C', a.repo, 'push', '-q', 'origin', 'main'])
    print('pushed:', a.slug, f'({dur}s, {os.path.getsize(mp4)//1024} KB)')


main()
