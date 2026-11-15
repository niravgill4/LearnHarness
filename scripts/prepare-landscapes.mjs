import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

// Rebuild only from the user's supplied exports; pass their attachment paths in order.
const names = ['rainforest-falls-mist', 'lighthouse-storm', 'cherry-blossom-river', 'camel-caravan-dusk', 'autumn-pagoda-maples'];
const inputs = process.argv.slice(2);
if (inputs.length !== names.length) throw new Error('Pass the five original export paths in the documented order.');
const out = resolve('public/landscapes');
mkdirSync(out, { recursive: true });
names.forEach((name, i) => {
 const filter = 'crop=1616:908:152:86,scale=1440:-2:flags=lanczos,setsar=1';
 execFileSync('ffmpeg', ['-y','-hide_banner','-loglevel','error','-i',inputs[i],'-an','-vf',filter,'-r','24','-c:v','libx264','-preset','slow','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',`${out}/${name}.mp4`], {stdio:'inherit'});
 execFileSync('ffmpeg', ['-y','-hide_banner','-loglevel','error','-ss','1','-i',inputs[i],'-vf',filter,'-frames:v','1','-c:v','libwebp','-quality','88',`${out}/${name}.webp`], {stdio:'inherit'});
});
