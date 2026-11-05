/**
 * APEX CLIENT PORTAL — APPLICATION SCRIPT
 * Minimal tech stack implementation (zero build tools, zero dependencies)
 */

(function () {
  'use strict';

  // Check lockdown status on boot
  async function checkSystemLockdown() {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) return;

      const data = await res.json();

      if (data.isLocked && !data.unlockedInSession) {
        // Lockdown is active: inject isolated lockdown assets if not already mounted
        mountLockscreen();
      }

      // Sync developer contact information from flag stats
      if (data.devContact) {
        const roleEl = document.getElementById('portal-dev-role');
        const phoneEl = document.getElementById('portal-dev-phone');
        const emailEl = document.getElementById('portal-dev-email');
        if (roleEl && data.devContact.role) roleEl.textContent = data.devContact.role;
        if (phoneEl && data.devContact.phone) phoneEl.textContent = data.devContact.phone;
        if (emailEl && data.devContact.email) emailEl.textContent = data.devContact.email;
      }
    } catch (err) {
      console.warn('[CND Telemetry] Failed checking perimeter state:', err);
    }
  }

  // Mounts the isolated lockscreen interface
  async function mountLockscreen() {
    if (document.getElementById('cnd-lockdown-container')) return;

    try {
      // 1. Link isolated stylesheet
      let linkEl = document.getElementById('lockdown-style-link');
      if (!linkEl) {
        linkEl = document.createElement('link');
        linkEl.rel = 'stylesheet';
        document.head.appendChild(linkEl);
      }
      linkEl.href = '/lockdown/lockscreen.css';

      // 2. Fetch isolated HTML template
      const htmlRes = await fetch('/lockdown/lockscreen.html');
      if (!htmlRes.ok) return;
      const htmlText = await htmlRes.text();

      const slot = document.getElementById('lockdown-slot') || document.body;
      slot.innerHTML = htmlText;

      // 3. Load isolated lockscreen controller
      const scriptEl = document.createElement('script');
      scriptEl.src = '/lockdown/lockscreen.js';
      document.body.appendChild(scriptEl);
    } catch (err) {
      console.error('[CND Lockdown] Error mounting isolated lockscreen:', err);
    }
  }

  // Periodic subtle telemetry jitter to keep the demo dynamic and alive
  function initLiveTelemetry() {
    const refreshBtn = document.getElementById('refresh-status-btn');
    const nodesTbody = document.getElementById('nodes-tbody');

    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        refreshBtn.textContent = 'Syncing...';
        refreshBtn.disabled = true;

        setTimeout(() => {
          updateNodeLatencies();
          refreshBtn.textContent = 'Sync Telemetry';
          refreshBtn.disabled = false;
        }, 450);
      });
    }

    function updateNodeLatencies() {
      if (!nodesTbody) return;
      const rows = nodesTbody.querySelectorAll('tr');
      rows.forEach(row => {
        const latencyCell = row.children[3];
        if (latencyCell) {
          const current = parseFloat(latencyCell.textContent);
          const jitter = (Math.random() * 2 - 1).toFixed(1);
          const updated = Math.max(8.0, (current + parseFloat(jitter))).toFixed(1);
          latencyCell.textContent = `${updated} ms`;
        }
      });
    }

    // Auto sync telemetry every 15 seconds
    setInterval(updateNodeLatencies, 15000);
  }

  document.addEventListener('DOMContentLoaded', () => {
    checkSystemLockdown();
    initLiveTelemetry();
  });
})();
