/**
 * README demo GIF
 *
 * Usage:
 *   node scripts/demo-gif.js [frames.txt] [output.gif]
 *
 * Runs after `playwright test -c e2e/demo.config.ts` (together:
 * `npm run demo-gif`). The spec captures the frames of a short tour of the
 * app, only during the moments worth keeping, and writes
 * `test-results/demo/frames.txt`, a list for ffmpeg's concat demuxer with
 * the real duration of every frame. This script joins the frames and
 * encodes a palette-optimised GIF. It needs ffmpeg on the PATH and keeps
 * the result under 5 MB by trying smaller widths and frame rates in turn.
 *
 * Default output: docs/images/demo.gif.
 */

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const framesPath = path.resolve(
  process.argv[2] ?? path.join(ROOT, 'test-results/demo/frames.txt')
);
const outPath = path.resolve(
  process.argv[3] ?? path.join(ROOT, 'docs/images/demo.gif')
);
const MAX_BYTES = 5 * 1024 * 1024;
// Tried in order until the GIF fits: width in pixels and frames per second.
const ATTEMPTS = [
  [1280, 12],
  [1120, 12],
  [960, 12],
  [960, 10],
  [800, 10],
];

function main() {
  const list = fs.readFileSync(framesPath, 'utf8');
  const frames = (list.match(/^file /gm) ?? []).length;
  const seconds = [...list.matchAll(/^duration ([\d.]+)/gm)].reduce(
    (sum, m) => sum + Number(m[1]),
    0
  );
  if (frames === 0) throw new Error(`No frames listed in ${framesPath}`);
  console.log(`${frames} frames, ${seconds.toFixed(1)}s`);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  for (const [width, fps] of ATTEMPTS) {
    const filter =
      `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];` +
      '[a]palettegen=stats_mode=diff[p];' +
      '[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle';
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-v',
        'error',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        framesPath,
        '-vf',
        filter,
        '-loop',
        '0',
        outPath,
      ],
      { stdio: ['ignore', 'inherit', 'inherit'] }
    );
    const bytes = fs.statSync(outPath).size;
    console.log(
      `${width}px @ ${fps} fps: ${(bytes / 1024 / 1024).toFixed(2)} MB`
    );
    if (bytes <= MAX_BYTES) {
      console.log(`Wrote ${path.relative(ROOT, outPath)}`);
      return;
    }
  }
  throw new Error(
    `The GIF stays above ${MAX_BYTES / 1024 / 1024} MB; shorten the tour`
  );
}

main();
