#!/usr/bin/env node
/**
 * REMOTE TOGGLE LOCK & KILLSWITCH MONITOR
 * CND Remote Killswitch PoC
 *
 * Monitored URL: https://dontpad.com/c2FhaGl0Cg==
 * Polling Interval: 5 seconds (5000ms)
 * Threshold for '0': 60 seconds (1 minute)
 *
 * Operational Rules:
 * 1. While URL content remains '0' for 1 minute:
 *    -> Locks down the site (isLocked: true) and STOPS POLLING (exits).
 *       The only way to unlock is via password in the web UI.
 * 2. If URL content changes to '1' within that minute (or anytime):
 *    -> Moves lockdown/ folder to .bin/lockdown/, unlocks site, and STOPS POLLING (exits).
 * 3. Once password is entered in the lockscreen UI:
 *    -> server.js moves lockdown/ to .bin/lockdown/ and unlocks site.
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, "..")

const lockdownDir = path.join(rootDir, "lockdown")
const binDir = path.join(rootDir, ".bin")
const binLockdownDir = path.join(binDir, "lockdown")
const flagPath = path.join(lockdownDir, "flag.json")

const TARGET_URL = "https://dontpad.com/c2FhaGl0Cg=="
const POLL_INTERVAL_MS = 5000
const LOCKDOWN_THRESHOLD_MS = 30000 // 30 seconds

// Helper: Ensure .bin directory exists
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true })
}

// -----------------------------------------------------------------------------
// Manual toggle mode (--flip or --manual)
// -----------------------------------------------------------------------------
if (process.argv.includes("--flip") || process.argv.includes("--manual")) {
  if (!fs.existsSync(flagPath)) {
    if (fs.existsSync(binLockdownDir)) {
      console.log("[*] Restoring lockdown folder from .bin/ for manual toggle...")
      fs.renameSync(binLockdownDir, lockdownDir)
    } else {
      console.error("[!] Neither lockdown/ nor .bin/lockdown/ found.")
      process.exit(1)
    }
  }

  const content = JSON.parse(fs.readFileSync(flagPath, "utf8"))
  content.isLocked = !content.isLocked
  content.timestamp = new Date().toISOString()
  fs.writeFileSync(flagPath, JSON.stringify(content, null, 2) + "\n", "utf8")

  console.log("------------------------------------------------------------")
  console.log(` [+] Manual Toggle: isLocked is now ${content.isLocked ? "TRUE (Locked)" : "FALSE (Unlocked)"}`)
  console.log("------------------------------------------------------------")
  process.exit(0)
}

// -----------------------------------------------------------------------------
// Quarantine & Lockdown Handlers
// -----------------------------------------------------------------------------
function lockDownSite() {
  if (!fs.existsSync(lockdownDir) && fs.existsSync(binLockdownDir)) {
    fs.renameSync(binLockdownDir, lockdownDir)
    console.log("[+] Restored lockdown/ folder from .bin/ to engage security barrier.")
  }

  if (fs.existsSync(flagPath)) {
    const content = JSON.parse(fs.readFileSync(flagPath, "utf8"))
    content.isLocked = true
    content.timestamp = new Date().toISOString()
    fs.writeFileSync(flagPath, JSON.stringify(content, null, 2) + "\n", "utf8")
  }

  console.log("============================================================")
  console.log(' [!] 30-SECOND THRESHOLD REACHED: URL remained "0" for 30s.')
  console.log(" [!] LOCKDOWN ENGAGED: isLocked set to TRUE.")
  console.log(" [!] The website is now LOCKED DOWN.")
  console.log(" [!] STOPPING POLLING NOW: Unlock must be performed via password in web UI.")
  console.log("============================================================")
}

function moveToBinAndUnlock(reason) {
  if (fs.existsSync(lockdownDir)) {
    if (fs.existsSync(binLockdownDir)) {
      fs.rmSync(binLockdownDir, { recursive: true, force: true })
    }
    fs.renameSync(lockdownDir, binLockdownDir)
    console.log("============================================================")
    console.log(` [!] TRIGGER DETECTED (${reason})`)
    console.log(" [!] Moved lockdown/ folder to .bin/lockdown/")
    console.log(" [!] The website is now UNLOCKED and DISARMED.")
    console.log(" [!] STOPPING POLLING NOW: Mission accomplished.")
    console.log("============================================================")
  } else {
    console.log("============================================================")
    console.log(`[*] ${reason}: lockdown/ is already in .bin/lockdown/ (Site is unlocked).`)
    console.log(" [*] STOPPING POLLING NOW.")
    console.log("============================================================")
  }
}

// -----------------------------------------------------------------------------
// Fetch URL Content from Dontpad
// -----------------------------------------------------------------------------
async function fetchDontpadContent(targetUrl) {
  const parsed = new URL(targetUrl)
  const apiUrl = `https://api.dontpad.com${parsed.pathname}.body.json?lastModified=0`

  try {
    const res = await fetch(apiUrl, {
      signal: AbortSignal.timeout(4000),
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": targetUrl,
        "Accept": "application/json, text/plain, */*",
      },
    })

    if (res.ok) {
      const data = await res.json()
      if (data && typeof data.body === "string") {
        return data.body.trim()
      }
    }
  } catch (err) {
    // API timeout or network issue, proceed to fallback
  }

  try {
    const res = await fetch(targetUrl, {
      signal: AbortSignal.timeout(4000),
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    })
    if (res.ok) {
      const html = await res.text()
      const match = html.match(/<textarea[^>]*id=['"]text['"][^>]*>([\s\S]*?)<\/textarea>/i)
      if (match) {
        return match[1].trim()
      }
    }
  } catch (err) {
    // Fallback error
  }

  return null
}

// -----------------------------------------------------------------------------
// Polling Loop State Machine
// -----------------------------------------------------------------------------
let zeroStartedAt = Date.now()

// Initial Setup: Ensure lockdown folder is active and starts unlocked for countdown
if (!fs.existsSync(lockdownDir) && fs.existsSync(binLockdownDir)) {
  fs.renameSync(binLockdownDir, lockdownDir)
}
if (fs.existsSync(flagPath)) {
  const content = JSON.parse(fs.readFileSync(flagPath, "utf8"))
  content.isLocked = false
  content.timestamp = new Date().toISOString()
  fs.writeFileSync(flagPath, JSON.stringify(content, null, 2) + "\n", "utf8")
}

console.log("============================================================")
console.log(" REMOTE TOGGLE LOCK & KILLSWITCH MONITOR STARTED")
console.log(` Target URL       : ${TARGET_URL}`)
console.log(` Polling Interval : ${POLL_INTERVAL_MS / 1000} seconds`)
console.log(` Threshold for 0  : ${LOCKDOWN_THRESHOLD_MS / 1000} seconds`)
console.log(" Initial State    : Site UNLOCKED (Timer initiated)")
console.log("============================================================\n")

let isExiting = false

async function poll() {
  if (isExiting) return

  const content = await fetchDontpadContent(TARGET_URL)
  const now = new Date().toLocaleTimeString()

  if (content === null) {
    console.log(`[${now}] [WARN] Unable to reach ${TARGET_URL}. Retrying in 5s...`)
    return
  }

  console.log(`[${now}] Fetched content: "${content}"`)

  if (content === "0") {
    if (!zeroStartedAt) {
      zeroStartedAt = Date.now()
    }

    const elapsedMs = Date.now() - zeroStartedAt
    const elapsedSec = Math.floor(elapsedMs / 1000)
    const targetSec = LOCKDOWN_THRESHOLD_MS / 1000

    if (elapsedMs < LOCKDOWN_THRESHOLD_MS) {
      console.log(`  -> Content remains '0': ${elapsedSec}s / ${targetSec}s elapsed. Site remains unlocked.`)
    } else {
      // 1 minute exceeded -> Lock down site and KILL SCRIPT (stop polling)
      isExiting = true
      clearInterval(intervalTimer)
      lockDownSite()
      process.exit(0)
    }
  } else if (content === "1") {
    // Changed to '1' -> Move to .bin/ and KILL SCRIPT (stop polling)
    isExiting = true
    clearInterval(intervalTimer)
    moveToBinAndUnlock("URL content changed to '1'")
    process.exit(0)
  } else {
    console.log(`  -> Unrecognized content: "${content}". (Expected '0' or '1')`)
  }
}

// Initial poll + interval
poll()
const intervalTimer = setInterval(poll, POLL_INTERVAL_MS)

// Handle clean shutdown
process.on("SIGINT", () => {
  clearInterval(intervalTimer)
  console.log("\n[*] Stopping monitor. Exiting cleanly.")
  process.exit(0)
})
process.on("SIGTERM", () => {
  clearInterval(intervalTimer)
  process.exit(0)
})
