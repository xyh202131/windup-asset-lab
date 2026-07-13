#!/usr/bin/env node
// Import a horizontal Windup sprite sheet without rescaling or re-matting it.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const [sheetArg, outputArg, countArg = '8', prefix = 'walk'] = process.argv.slice(2);
if (!sheetArg || !outputArg) {
  console.error('Usage: node tools/import-windup-sheet.js <sheet.png> <output-dir> [count] [prefix]');
  process.exit(1);
}

async function main() {
  const sheet = path.resolve(sheetArg);
  const output = path.resolve(outputArg);
  const count = Number(countArg);
  const probe = JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', sheet,
  ], { encoding: 'utf8' }));
  const { width, height } = probe.streams[0] || {};
  if (!width || !height || !Number.isInteger(count) || count < 1 || width % count !== 0) {
    throw new Error(`Invalid horizontal sheet: ${width}x${height}, count=${count}`);
  }

  const cell = width / count;
  if (cell !== height) throw new Error(`Expected square cells, got ${cell}x${height}`);
  await fs.promises.mkdir(output, { recursive: true });

  for (let index = 0; index < count; index += 1) {
    const target = path.join(output, `${prefix}-${String(index + 1).padStart(2, '0')}.png`);
    execFileSync('ffmpeg', [
      '-loglevel', 'error', '-y', '-i', sheet, '-vf', `crop=${cell}:${cell}:${index * cell}:0`, '-frames:v', '1', target,
    ]);
  }
  console.log(`Imported ${count} exact ${cell}x${cell} frames into ${output}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
