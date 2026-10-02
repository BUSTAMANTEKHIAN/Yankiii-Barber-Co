'use strict';

(async function loadPublicBusinessHours() {
    const targets = document.querySelectorAll('[data-business-hours]');
    if (!targets.length) return;

    try {
        const response = await window.api.get('/business-hours');
        if (!response.success || !Array.isArray(response.data) || response.data.length !== 7) {
            throw new Error(response.message || 'Business hours are unavailable.');
        }

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const label = response.data.map(day => {
            const name = days[Number(day.day_of_week)];
            if (!name) return null;
            if (!(day.is_open === 1 || day.is_open === true)) return `${name}: Closed`;
            const format = value => {
                const [hour, minute] = String(value || '').slice(0, 5).split(':').map(Number);
                if (!Number.isFinite(hour) || !Number.isFinite(minute)) return '';
                return new Date(2000, 0, 1, hour, minute).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
            };
            return `${name}: ${format(day.open_time)}–${format(day.close_time)}`;
        }).filter(Boolean).join(' · ');

        targets.forEach(target => { target.textContent = label || 'Business hours unavailable.'; });
    } catch (_) {
        targets.forEach(target => { target.textContent = 'Please check available times when booking.'; });
    }
})();
