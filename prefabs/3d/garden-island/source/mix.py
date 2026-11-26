#!/usr/bin/env python3
"""Joins the captured frames, the narration and the music into film/out/<name>.mp4.

    python3 tools/mix.py <music file> [name]

Reads film/timeline.json (written by tools/film.mjs) and film/voice/<line>.wav.
The music runs the whole length, is pulled down while a line is spoken, fades
in and out; the whole is brought to -14 LUFS.
"""
import json
import os
import subprocess
import sys

here = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
music = sys.argv[1]
name = sys.argv[2] if len(sys.argv) > 2 else 'a-day-off'
t = json.load(open(os.path.join(here, 'film/timeline.json')))
total, fps = t['total'], t['fps']
lines = [e for e in t['timeline'] if e.get('line')]
out = os.path.join(here, 'film/out')
os.makedirs(out, exist_ok=True)

inputs = ['-framerate', str(fps), '-i', os.path.join(here, 'film/frames/f%05d.jpg'), '-i', music]
for e in lines:
    inputs += ['-i', os.path.join(here, 'film/voice', e['line'] + '.wav')]
parts = []
for i, e in enumerate(lines):
    ms = int(round(e['voiceAt'] * 1000))
    parts.append(f'[{i + 2}:a]aresample=48000,adelay={ms}:all=1[v{i}]')
mixed = ''.join(f'[v{i}]' for i in range(len(lines)))
parts.append(f'{mixed}amix=inputs={len(lines)}:normalize=0:duration=longest,apad=whole_dur={total},atrim=0:{total},asplit=2[voice][key]')
# The music: its start, level with the voice in mind, faded at both ends, ducked under the voice.
parts.append(f'[1:a]aresample=48000,atrim=0:{total},volume=0.42,afade=t=in:d=2.5,afade=t=out:st={total - 5}:d=5[bed]')
parts.append('[bed][key]sidechaincompress=threshold=0.02:ratio=9:attack=120:release=700[ducked]')
parts.append('[voice]volume=1.9[loud]')
parts.append('[ducked][loud]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11[a]')
target = os.path.join(out, name + '.mp4')
command = ['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', ';'.join(parts), '-map', '0:v', '-map', '[a]',
           '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', str(fps),
           '-c:a', 'aac', '-b:a', '192k', '-t', str(total), '-movflags', '+faststart', target]
subprocess.run(command, check=True)
probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,size', '-of', 'json', target], capture_output=True, text=True)
print(json.dumps({'file': target, **json.loads(probe.stdout)['format']}))
