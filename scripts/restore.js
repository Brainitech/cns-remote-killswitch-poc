#!/usr/bin/env node
/**
 * RESTORE SUBSYSTEM SCRIPT (TEST MODE UTILITY)
 * CND Remote Killswitch PoC
 * 
 * Restores the isolated lockdown subsystem from `.bin/lockdown/` back to `lockdown/`
 * allowing students, instructors, and evaluators to rerun test scenarios repeatedly.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const lockdownDir = path.join(rootDir, 'lockdown');
const binDir = path.join(rootDir, '.bin');
const quarantinedDest = path.join(binDir, 'lockdown');

console.log('[*] Restoring lockdown subsystem from .bin quarantine...');

if (!fs.existsSync(quarantinedDest)) {
  console.log('[!] No quarantined lockdown subsystem found in .bin/lockdown.');
  if (fs.existsSync(lockdownDir)) {
    console.log('[+] The lockdown directory is already present in the source tree.');
  }
  process.exit(0);
}

try {
  if (fs.existsSync(lockdownDir)) {
    fs.rmSync(lockdownDir, { recursive: true, force: true });
  }

  fs.renameSync(quarantinedDest, lockdownDir);

  console.log('------------------------------------------------------------');
  console.log(' [+] RESTORE COMPLETE');
  console.log(` [+] Moved back from : ${quarantinedDest}`);
  console.log(` [+] Restored to     : ${lockdownDir}`);
  console.log(' [+] Lockdown subsystem and flags are reinstated.');
  console.log('------------------------------------------------------------');
} catch (err) {
  console.error('[x] Restore failed:', err.message);
  process.exit(1);
}
