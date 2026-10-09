// Builds the Windows installer without Wine:
//   1. vite build                     → dist/
//   2. electron-builder --dir (win32) → release/win-unpacked (icon embedded by electron/afterPack.cjs)
//   3. makensis build/installer.nsi   → release/VocabQuest-Setup-<version>.exe
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit', ...opts });
const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

run('npx', ['vite', 'build']);
run('npx', ['electron-builder', '--win', 'dir', '--x64']);

function findMakensis() {
  if (process.env.MAKENSIS) return { bin: process.env.MAKENSIS };
  const cache = process.env.ELECTRON_BUILDER_CACHE ?? path.join(homedir(), '.cache', 'electron-builder');
  const nsisRoot = path.join(cache, 'nsis');
  for (const dir of existsSync(nsisRoot) ? readdirSync(nsisRoot).filter((d) => d.startsWith('nsis-3')) : []) {
    const home = path.join(nsisRoot, dir);
    const bin = path.join(home, process.platform === 'win32' ? 'makensis.exe' : `${process.platform === 'darwin' ? 'mac' : 'linux'}/makensis`);
    if (existsSync(bin)) return { bin, home };
  }
  return { bin: 'makensis' }; // system NSIS
}

const { bin, home } = findMakensis();
const out = path.join(root, 'release', `VocabQuest-Setup-${version}.exe`);
run(bin, [
  `-DVERSION=${version}`,
  `-DSRC_DIR=${path.join(root, 'release', 'win-unpacked')}`,
  `-DOUT_FILE=${out}`,
  `-DICON=${path.join(root, 'build', 'icon.ico')}`,
  path.join(root, 'build', 'installer.nsi'),
], { env: { ...process.env, ...(home ? { NSISDIR: home } : {}) } });
console.log(`\nInstaller: ${out}`);
