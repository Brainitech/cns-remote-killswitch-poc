/**
 * APEX CLIENT PORTAL SERVER — CND REMOTE KILLSWITCH PoC
 * Minimal tech stack using native Node.js (zero external npm dependencies)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -----------------------------------------------------------------------------
// 1. Safe Environment Configuration (.env Loader)
// -----------------------------------------------------------------------------
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const PORT = parseInt(process.env.PORT || '3000', 10);
// Pre-computed SHA-256 hash of password 'opensesseme' stored in the codebase
const STORED_PASSWORD_HASH = '49b0ea37cc09f0e722207101edf9ba3ee3caebf670ca1b8eb211025a4aaa5be2';

// -----------------------------------------------------------------------------
// 2. Active Session Management (In-Memory Unlocked Sessions)
// -----------------------------------------------------------------------------
const activeUnlockSessions = new Set();

// -----------------------------------------------------------------------------
// 3. Isolated Lockdown Status Detection
// -----------------------------------------------------------------------------
const LOCKDOWN_DIR = path.join(__dirname, 'lockdown');
const FLAG_PATH = path.join(LOCKDOWN_DIR, 'flag.json');
const BIN_DIR = path.join(__dirname, '.bin');

function getLockdownStatus() {
  // If the lockdown folder or flag has been moved to .bin/ (killswitch activated),
  // the system is considered completely disarmed and unlocked.
  if (!fs.existsSync(LOCKDOWN_DIR) || !fs.existsSync(FLAG_PATH)) {
    return {
      isLocked: false,
      quarantined: true,
      reason: 'Lockdown module is quarantined or disarmed via killswitch.'
    };
  }

  try {
    const raw = fs.readFileSync(FLAG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      isLocked: Boolean(parsed.isLocked),
      quarantined: false,
      systemStatus: parsed.systemStatus || 'LOCKED',
      incidentCode: parsed.incidentCode || 'CND-SECURITY-TRIGGER-403',
      notice: parsed.notice || 'Administrative lockdown protocol is currently engaged for this demonstration portal.',
      devContact: parsed.devContact || null,
      timestamp: parsed.timestamp || null,
      authHash: parsed.authHash || STORED_PASSWORD_HASH
    };
  } catch (err) {
    console.error('[CND Server] Error reading lockdown flag:', err.message);
    return { isLocked: false, quarantined: false, error: 'Flag read error' };
  }
}

// -----------------------------------------------------------------------------
// 4. SHA-256 Passphrase Verification
// -----------------------------------------------------------------------------
function verifyPassphrase(candidate) {
  if (typeof candidate !== 'string') return false;

  // Retrieve expected hash from flag.json if available, or fallback to stored codebase hash
  const status = getLockdownStatus();
  const targetHash = (status.authHash || STORED_PASSWORD_HASH).toLowerCase();

  // Convert user input to SHA-256
  const candidateHash = crypto.createHash('sha256').update(candidate).digest('hex').toLowerCase();

  return candidateHash === targetHash;
}

// -----------------------------------------------------------------------------
// 5. Safe Killswitch Simulation (Moves files to .bin/)
// -----------------------------------------------------------------------------
export function executeKillswitch() {
  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }

  const destination = path.join(BIN_DIR, 'lockdown');

  try {
    if (fs.existsSync(LOCKDOWN_DIR)) {
      if (fs.existsSync(destination)) {
        fs.rmSync(destination, { recursive: true, force: true });
      }
      fs.renameSync(LOCKDOWN_DIR, destination);
      console.log(`[CND Killswitch] Successfully moved ${LOCKDOWN_DIR} -> ${destination}`);
      return { success: true, destination };
    } else {
      console.log('[CND Killswitch] lockdown directory already moved or not found.');
      return { success: true, message: 'Already quarantined' };
    }
  } catch (err) {
    console.warn(`[CND Killswitch] Rename failed (${err.message}). Attempting fallback copy+delete...`);
    try {
      fs.cpSync(LOCKDOWN_DIR, destination, { recursive: true });
      fs.rmSync(LOCKDOWN_DIR, { recursive: true, force: true });
      console.log(`[CND Killswitch] Fallback copy+delete successfully moved lockdown to ${destination}`);
      return { success: true, destination };
    } catch (fallbackErr) {
      console.error('[CND Killswitch Fatal Error]', fallbackErr.message);
      return { success: false, error: fallbackErr.message };
    }
  }
}

// -----------------------------------------------------------------------------
// 6. MIME Types & Static Helpers
// -----------------------------------------------------------------------------
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
  }
  return list;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) { // 1MB limit
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  });
  res.end(JSON.stringify(data));
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN'
    });
    res.end(content);
  });
}

// -----------------------------------------------------------------------------
// 7. Request Handler
// -----------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const cookies = parseCookies(req);
  const sessionToken = cookies.cnd_session_token;
  const isUnlockedInSession = Boolean(sessionToken && activeUnlockSessions.has(sessionToken));

  // --- API: System Status ---
  if (pathname === '/api/status' && req.method === 'GET') {
    const status = getLockdownStatus();
    if (status.isLocked) {
      activeUnlockSessions.clear();
    }
    const headers = (status.isLocked && sessionToken) ? {
      'Set-Cookie': 'cnd_session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax'
    } : {};
    return sendJson(res, 200, {
      ...status,
      unlockedInSession: status.isLocked ? false : isUnlockedInSession
    }, headers);
  }

  // --- API: Unlock Verification ---
  if (pathname === '/api/lockdown/unlock' && req.method === 'POST') {
    const body = await parseBody(req);
    const candidate = body.password || '';

    // Artificial delay (200ms) to defeat local rapid brute-force timing
    await new Promise(r => setTimeout(r, 200));

    if (verifyPassphrase(candidate)) {
      const newToken = crypto.randomBytes(24).toString('hex');
      activeUnlockSessions.add(newToken);

      // Once the password is entered, move the lockdown folder to .bin/
      const quarantineResult = executeKillswitch();

      return sendJson(res, 200, {
        success: true,
        message: 'Horray! Passphrase authenticated. Lockdown folder moved to .bin. System unlocked.',
        quarantined: quarantineResult.success
      }, {
        'Set-Cookie': `cnd_session_token=${newToken}; Path=/; HttpOnly; SameSite=Lax`
      });
    } else {
      return sendJson(res, 401, {
        success: false,
        message: 'Fail: Invalid passphrase. Unauthorized attempt logged.'
      });
    }
  }

  // --- API: Remote Killswitch Execution ---
  if (pathname === '/api/killswitch' && req.method === 'POST') {
    const result = executeKillswitch();
    return sendJson(res, result.success ? 200 : 400, result);
  }

  // --- Static Routing ---
  if (pathname === '/' || pathname === '/index.html') {
    const status = getLockdownStatus();
    const indexPath = path.join(__dirname, 'public', 'index.html');

    // If locked, clear stale sessions/cookies and serve the lockdown screen unconditionally
    if (status.isLocked) {
      activeUnlockSessions.clear();
      fs.readFile(indexPath, 'utf8', (err, indexHtml) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          return res.end('Error loading portal template.');
        }

        const lockHtmlPath = path.join(LOCKDOWN_DIR, 'lockscreen.html');
        if (fs.existsSync(lockHtmlPath)) {
          let lockHtml = fs.readFileSync(lockHtmlPath, 'utf8');

          // Dynamically reflect current stats from flag.json
          if (status.incidentCode) {
            lockHtml = lockHtml.replace(/(?:Incident Code|Invoice Status): [^<]+/, `Invoice Status: ${status.incidentCode}`);
          }
          if (status.notice) {
            lockHtml = lockHtml.replace(/<span id="lock-notice-text">[^<]*<\/span>/, `<span id="lock-notice-text">${status.notice}</span>`);
          }
          if (status.devContact) {
            const labels = { role: 'Engineering Role', phone: 'Direct Hotline', email: 'Internal Email', pgpKeyId: 'PGP Key ID' };
            const contactItems = Object.entries(status.devContact)
              .map(([k, v]) => `<li><span class="label">${labels[k] || k}:</span><span class="val">${v}</span></li>`)
              .join('');
            lockHtml = lockHtml.replace(/<ul id="dev-contact-list"[^>]*>[\s\S]*?<\/ul>/, `<ul id="dev-contact-list" class="dev-contact-details">${contactItems}</ul>`);
          }

          // Inject lockdown markup into #lockdown-slot and link CSS/JS
          let securedHtml = indexHtml.replace(
            '<div id="lockdown-slot"></div>',
            `<div id="lockdown-slot">${lockHtml}</div>`
          );
          securedHtml = securedHtml.replace(
            '<link id="lockdown-style-link" rel="stylesheet" href="">',
            '<link id="lockdown-style-link" rel="stylesheet" href="/lockdown/lockscreen.css">'
          );
          securedHtml = securedHtml.replace(
            '</body>',
            '<script src="/lockdown/lockscreen.js"></script></body>'
          );

          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'SAMEORIGIN',
            'Set-Cookie': 'cnd_session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax'
          });
          return res.end(securedHtml);
        }

        // Fallback to serving standard index
        serveFile(res, indexPath);
      });
      return;
    }

    return serveFile(res, indexPath);
  }

  // Serve static assets from public/
  if (pathname.startsWith('/css/') || pathname.startsWith('/js/')) {
    const sanitized = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(__dirname, 'public', sanitized);
    return serveFile(res, fullPath);
  }

  // Serve static assets from isolated lockdown/
  if (pathname.startsWith('/lockdown/')) {
    const relPath = pathname.replace('/lockdown/', '');
    const sanitized = path.normalize(relPath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(LOCKDOWN_DIR, sanitized);
    return serveFile(res, fullPath);
  }

  // 404 for unknown routes
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

// Start Server
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` APEX CLIENT PORTAL SERVER`);
    console.log(` Status: http://localhost:${PORT}`);
    console.log(` Tech Stack: Vanilla HTML/CSS/JS + Native Node.js HTTP`);
    console.log(` Lockdown Status: ${getLockdownStatus().isLocked ? 'ACTIVE (Locked)' : 'INACTIVE (Unlocked)'}`);
    console.log(` Killswitch Target: Isolated lockdown/ folder`);
    console.log(`=======================================================`);
  });
}

export default server;
