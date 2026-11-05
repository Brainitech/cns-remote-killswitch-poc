/**
 * ISOLATED LOCKDOWN SUBSYSTEM CONTROLLER
 * CND Remote Killswitch PoC
 * 
 * Password Authentication:
 * Password is 'opensesseme'
 * Pre-computed SHA-256 hash stored in codebase:
 * 49b0ea37cc09f0e722207101edf9ba3ee3caebf670ca1b8eb211025a4aaa5be2
 */

(function () {
  'use strict';

  // SHA-256 hash of 'opensesseme' stored in the codebase
  const STORED_PASSWORD_HASH = '49b0ea37cc09f0e722207101edf9ba3ee3caebf670ca1b8eb211025a4aaa5be2';

  // Helper: Convert string to SHA-256 hex digest
  async function computeSHA256(text) {
    if (window.crypto && crypto.subtle) {
      const buffer = new TextEncoder().encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
    return '';
  }

  // Reflect dynamic stats from flag.json via /api/status
  async function syncStatsFromFlag() {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) return;
      const data = await res.json();

      if (data.incidentCode) {
        const badge = document.getElementById('lock-incident-badge');
        if (badge) badge.textContent = `Incident Code: ${data.incidentCode}`;
      }

      if (data.notice) {
        const noticeEl = document.getElementById('lock-notice-text');
        if (noticeEl) noticeEl.textContent = data.notice;
      }

      if (data.devContact) {
        const list = document.getElementById('dev-contact-list');
        if (list) {
          list.innerHTML = '';
          const labels = {
            role: 'Engineering Role',
            phone: 'Direct Hotline',
            email: 'Internal Email',
            pgpKeyId: 'PGP Key ID'
          };

          for (const [key, value] of Object.entries(data.devContact)) {
            const li = document.createElement('li');
            const labelSpan = document.createElement('span');
            labelSpan.className = 'label';
            labelSpan.textContent = (labels[key] || key) + ':';

            const valSpan = document.createElement('span');
            valSpan.className = 'val';
            valSpan.textContent = value;

            li.appendChild(labelSpan);
            li.appendChild(valSpan);
            list.appendChild(li);
          }
        }
      }
    } catch (e) {
      // Offline or static fallback: values from lockscreen.html template are preserved
    }
  }

  function initLockscreen() {
    const form = document.getElementById('lockdown-form');
    const pwdInput = document.getElementById('lockdown-pwd-input');
    const toggleBtn = document.getElementById('toggle-pwd-btn');
    const submitBtn = document.getElementById('lockdown-submit-btn');
    const btnText = document.getElementById('btn-text');
    const msgBox = document.getElementById('lockdown-msg');
    const card = document.querySelector('.lockdown-card');

    syncStatsFromFlag();

    if (!form || !pwdInput) return;

    // Toggle password visibility
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        const isPassword = pwdInput.type === 'password';
        pwdInput.type = isPassword ? 'text' : 'password';
        toggleBtn.textContent = isPassword ? 'HIDE' : 'SHOW';
      });
    }

    // Submit handler
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const candidatePassword = pwdInput.value;
      if (!candidatePassword) {
        showMessage('Please enter the administrative passphrase.', 'error');
        pwdInput.focus();
        return;
      }

      submitBtn.disabled = true;
      btnText.textContent = 'Computing SHA-256 & Verifying...';
      msgBox.className = 'lockdown-message';
      msgBox.textContent = '';

      try {
        // Hash user input to SHA-256
        const inputHash = await computeSHA256(candidatePassword);

        const response = await fetch('/api/lockdown/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            password: candidatePassword,
            inputHash: inputHash
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          showMessage('Horray! Passphrase authenticated. Moving lockdown files to .bin...', 'success');
          pwdInput.disabled = true;

          setTimeout(() => {
            const container = document.getElementById('cnd-lockdown-container');
            if (container) {
              container.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
              container.style.opacity = '0';
              container.style.transform = 'scale(1.02)';
              setTimeout(() => {
                container.remove();
                window.location.reload();
              }, 400);
            }
          }, 600);
        } else {
          const errorMsg = data.message || 'Authentication failed: Invalid passphrase.';
          showMessage(errorMsg, 'error');

          if (card) {
            card.classList.remove('shake-card');
            void card.offsetWidth;
            card.classList.add('shake-card');
          }

          pwdInput.value = '';
          pwdInput.focus();
        }
      } catch (err) {
        console.error('[CND Auth Error]', err);
        showMessage('Unable to reach server authentication endpoint. Please ensure node server.js is running.', 'error');
      } finally {
        submitBtn.disabled = false;
        btnText.textContent = 'Authenticate & Disengage Lockdown';
      }
    });

    function showMessage(text, type) {
      msgBox.className = `lockdown-message ${type}`;
      msgBox.textContent = text;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLockscreen);
  } else {
    initLockscreen();
  }
})();
