#!/usr/bin/env node
/**
 * KILLSWITCH TRIGGER SCRIPT (TEST MODE)
 * CND Remote Killswitch PoC
 * 
 * In production, a self-destruct would permanently delete (`rm -rf`) the target files.
 * Per specification for this PoC assignment testing, this script safely moves the
 * isolated lockdown subsystem and flag into the `.bin/` directory on the repository.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const lockdownDir = path.join(rootDir, 'lockdown');
const binDir = path.join(rootDir, '.bin');
const targetDest = path.join(binDir, 'lockdown');

console.log('[*] INITIATING REMOTE KILLSWITCH SEQUENCE...');

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

if (!fs.existsSync(lockdownDir)) {
  console.log('[!] Lockdown subsystem is not present in source tree (already quarantined in .bin/).');
  process.exit(0);
}

try {
  // If a previous backup exists in .bin/lockdown, clean it up before moving
  if (fs.existsSync(targetDest)) {
    fs.rmSync(targetDest, { recursive: true, force: true });
  }

  // Move entire lockdown subsystem into .bin/
  fs.renameSync(lockdownDir, targetDest);

  console.log('------------------------------------------------------------');
  console.log(' [+] KILLSWITCH EXECUTION COMPLETE');
  console.log(` [+] Quarantined source : ${lockdownDir}`);
  console.log(` [+] Quarantined target : ${targetDest}`);
  console.log(' [+] The website is now disarmed and fully unlocked.');
  console.log(' [+] To restore for repeated testing: npm run restore');
  console.log('------------------------------------------------------------');
} catch (err) {
  console.error('[x] Killswitch execution failed:', err.message);
  process.exit(1);
}
