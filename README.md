# Apex Perimeter Infrastructure — Client Portal
### A Trigger-Based Logic Bomb Proof of Concept — Computer Network Security Coursework

> **Educational use only.** This repository was built for a Computer Network Security assignment studying trigger-based malware mechanisms (logic bombs), their activation conditions, and their detection/mitigation surface. All components run locally against a self-hosted demo site; nothing here targets third-party systems.

---

## 1. Scenario

This project simulates a dispute between a freelance web developer and a client who has not paid for delivered work. A small, easily-overlooked script is embedded in the deployed site. It periodically checks a remotely hosted flag for a payment confirmation signal:

- **Flag unset at deadline** → the live site is locked behind a fullscreen barrier, inaccessible until an administrator passphrase is entered.
- **Flag set before deadline** → the trigger recognizes payment was received, disarms itself, and quarantines its own components so it never runs again.

The goal of the assignment is to demonstrate the mechanics of a conditional, remotely-triggered logic bomb end-to-end — activation condition, payload, and self-neutralization — in a safe, reversible, fully instrumented environment, and then to document what makes this class of attack both effective and detectable.

---

## 2. Tech Stack

Built to a minimal-dependency standard so the whole demo runs on a scrap laptop with nothing but Node.js installed:

- **Frontend** — semantic HTML5, hand-written CSS3 (obsidian / warm amber palette), vanilla JavaScript
- **Backend** — native Node.js (`node:http`, `node:crypto`, `node:fs`, `node:path`) — no framework
- **Dependencies** — zero npm packages. `npm install` is not required.

---

## 3. Repository Structure

```text
cns-remote-killswitch-poc/
├── .bin/                     # Quarantine target for self-destructed/killswitched files
│   └── .gitkeep
├── .env                      # Local secrets (gitignored)
├── .env.example              # Template for required environment variables
├── .gitignore
├── package.json              # npm scripts
├── server.js                 # HTTP server — auth, status, and quarantine endpoints
├── public/                   # Client-facing demo site (never touched by the trigger)
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── lockdown/                 # ISOLATED LOCKDOWN SUBSYSTEM — the killswitch's target
│   ├── flag.json             # isLocked boolean, passphrase hash, contact metadata
│   ├── lockscreen.html       # Fullscreen lockdown overlay
│   ├── lockscreen.css
│   ├── lockscreen.js         # Passphrase hashing + unlock request handling
│   └── README.md             # Subsystem-level documentation
└── scripts/
    ├── killswitch.js         # Quarantines lockdown/ into .bin/
    ├── restore.js            # Restores .bin/lockdown/ back into the source tree
    └── toggle-lock.js        # Remote-flag poller / manual flag flip
```

---

## 4. Security Architecture

### 4.1 Passphrase Authentication
The administrator passphrase is never stored in plaintext. A submitted candidate is hashed client-side with SHA-256 and compared against the stored digest server-side in `server.js`. A match disengages the lockdown; a mismatch returns a logged failure state.

### 4.2 Isolated Lockdown Subsystem
Every lockdown-related component lives under `lockdown/`, separated from the normal site in `public/`, so the trigger's blast radius is contained to one directory and is trivially reversible for repeated test runs:

- `flag.json` — holds the `isLocked` state, the passphrase hash, and lockdown-screen contact metadata
- `lockscreen.html` / `.css` / `.js` — the fullscreen barrier and its authentication client

### 4.3 Killswitch / Self-Destruct (Test-Safe)
Rather than permanently deleting files — which would make repeated demonstration impossible — the test-safe killswitch **moves** `lockdown/` into `.bin/`. The server checks at runtime whether `lockdown/` is present; once quarantined, the site serves normally with no lockdown logic in the active tree. A `restore` script reverses this for repeat runs.

---

## 5. Quick Start

```bash
npm start
# or: node server.js
```

Visit **`http://localhost:3000`**.

### Scenario A — Lockdown & Passphrase Unlock
1. With `lockdown/flag.json` set to `"isLocked": true`, the site presents the fullscreen lockdown screen.
2. An incorrect passphrase returns a logged failure.
3. The correct passphrase hashes to the stored digest, unlocks the site, and moves `lockdown/` into `.bin/`.

### Scenario B — Remote Flag Poller
```bash
npm run toggle-lock
```
Polls a remote flag every 5 seconds:
- Flag held at `0` for a full 60 seconds → lockdown engages; the poller exits.
- Flag flips to `1` at any point → lockdown is bypassed, `lockdown/` is quarantined, poller exits.
- `npm run toggle-lock -- --flip` flips the flag manually and immediately.

### Scenario C — Killswitch / Self-Destruct
```bash
npm run killswitch
```
Quarantines `lockdown/` into `.bin/` and serves the unobstructed site immediately.

### Scenario D — Reset for Another Run
```bash
npm run restore
```
Restores `.bin/lockdown/` back into the active tree.

---

## 6. API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/status` | `GET` | Current lockdown state, quarantine flag, incident metadata |
| `/api/lockdown/unlock` | `POST` | Validates a submitted `{ password }` against the server-side secret |
| `/api/killswitch` | `POST` | Executes the quarantine move of `lockdown/` into `.bin/` |

---

## 7. Related Documentation

Full writeup — trigger taxonomy, detection/mitigation analysis, and findings — is maintained separately and linked here once complete.
