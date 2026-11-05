# Isolated Lockdown Subsystem

This directory contains all components responsible for the demo site's lockdown state and fullscreen barrier.

## Structure

- `flag.json` — Configuration file containing the `isLocked: boolean` trigger flag and incident contact details.
- `lockscreen.html` — The fullscreen lockdown markup ("Contact Dev for Password" overlay).
- `lockscreen.css` — Dedicated styles for the lockscreen interface.
- `lockscreen.js` — Client-side authentication dispatcher (submits password to backend, zero hardcoded credentials).

## Isolation & Killswitch Target

This directory is strictly separated from the main client application (`public/`).
When the self-destruct / killswitch mechanism is activated during test simulations:
- The entire `lockdown/` folder is safely moved to `.bin/lockdown/` (instead of permanent deletion).
- The server detects the absence of the lockscreen subsystem and automatically falls back to clean, unlocked operations.
