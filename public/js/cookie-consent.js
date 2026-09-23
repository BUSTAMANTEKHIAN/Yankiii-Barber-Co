'use strict';

(() => {
    const COOKIE = 'ybc_cookie_preferences';
    let editing = false;
    let launcher = null;
    const readPreference = () => {
        const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
        if (!match) return null;
        try { return JSON.parse(decodeURIComponent(match[1])); } catch (_) { return null; }
    };
    const savePreference = value => {
        const secure = location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
        render();
    };
    const styles = `
      .cookie-banner{position:fixed;z-index:10000;inset:auto 16px 16px;max-width:760px;margin:auto;padding:20px;background:#fff;border:1px solid #d8e2d3;border-radius:14px;box-shadow:0 12px 40px #17231530;color:#263323;font:15px/1.5 system-ui,sans-serif}
      .cookie-banner h2{font-size:19px;margin:0 0 6px}.cookie-banner p{margin:0 0 14px}.cookie-actions{display:flex;flex-wrap:wrap;gap:10px}.cookie-actions button{min-height:44px;padding:10px 15px;border:1px solid #4a6e3d;border-radius:8px;background:#fff;color:#2d3a2a;font:600 14px system-ui;cursor:pointer}.cookie-actions .cookie-primary{background:#4a6e3d;color:white}.cookie-settings{margin-top:14px;padding-top:12px;border-top:1px solid #d8e2d3}.cookie-settings label{display:flex;align-items:center;gap:10px;padding:8px 0}.cookie-settings input{width:20px;height:20px}.cookie-banner a{color:#365a2e}@media(max-width:480px){.cookie-banner{inset:auto 8px 8px;padding:16px}.cookie-actions button{flex:1 1 44%}}
    `;
    function render() {
        document.getElementById('ybcCookieBanner')?.remove();
        const saved = readPreference();
        if (launcher) launcher.style.display = saved && !editing ? 'block' : 'none';
        if (saved && !editing) return;
        const style = document.getElementById('ybcCookieStyle') || Object.assign(document.createElement('style'), { id: 'ybcCookieStyle', textContent: styles });
        if (!style.isConnected) document.head.append(style);
        const banner = document.createElement('section');
        banner.className = 'cookie-banner'; banner.id = 'ybcCookieBanner'; banner.setAttribute('aria-label', 'Cookie choices');
        banner.innerHTML = `<h2>Cookie preferences</h2><p>Essential cookies keep the site and security features working. Optional analytics and marketing cookies are off; this site currently uses no analytics or advertising trackers. <a href="${document.querySelector('[data-cookie-policy]')?.getAttribute('href') || '/cookie-policy.html'}">Cookie policy</a></p><div class="cookie-actions"><button class="cookie-primary" data-choice="all">Accept All</button><button data-choice="essential">Reject Optional</button><button data-choice="settings" aria-expanded="false">Cookie Settings</button></div><div class="cookie-settings" hidden><label><input type="checkbox" checked disabled> Essential cookies <span>Always active</span></label><label><input type="checkbox" data-category="analytics"> Analytics cookies</label><label><input type="checkbox" data-category="marketing"> Marketing cookies</label><div class="cookie-actions"><button class="cookie-primary" data-choice="save">Save preferences</button></div></div>`;
        banner.querySelector('[data-category="analytics"]').checked = Boolean(saved?.analytics);
        banner.querySelector('[data-category="marketing"]').checked = Boolean(saved?.marketing);
        banner.addEventListener('click', event => {
            const button = event.target.closest('button[data-choice]'); if (!button) return;
            if (button.dataset.choice === 'settings') {
                const panel = banner.querySelector('.cookie-settings'); panel.hidden = !panel.hidden; button.setAttribute('aria-expanded', String(!panel.hidden)); return;
            }
            const all = button.dataset.choice === 'all';
            const analytics = all || (button.dataset.choice === 'save' && banner.querySelector('[data-category="analytics"]').checked);
            const marketing = all || (button.dataset.choice === 'save' && banner.querySelector('[data-category="marketing"]').checked);
            editing = false;
            savePreference({ essential: true, analytics, marketing, updatedAt: new Date().toISOString() });
        });
        document.body.append(banner);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true }); else render();
    window.openCookieSettings = () => {
        editing = true;
        render();
        const settingsButton = document.querySelector('#ybcCookieBanner [data-choice="settings"]');
        settingsButton?.click();
        document.querySelector('#ybcCookieBanner')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    };
    launcher = document.createElement('button');
    launcher.type = 'button'; launcher.textContent = 'Cookie settings'; launcher.setAttribute('aria-label', 'Open cookie settings');
    launcher.style.cssText = 'position:fixed;z-index:9998;left:12px;bottom:12px;min-height:40px;padding:8px 12px;border:1px solid #4a6e3d;border-radius:8px;background:#fff;color:#2d3a2a;font:600 13px system-ui;cursor:pointer;';
    launcher.addEventListener('click', window.openCookieSettings);
    document.body.append(launcher);
    launcher.style.display = readPreference() ? 'block' : 'none';
})();
