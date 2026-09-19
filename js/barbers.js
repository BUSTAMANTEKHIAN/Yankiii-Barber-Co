/**
 * Yankiii Barber Co. — Barbers Team Script
 * Fetches dynamic barbers from the API when available,
 * with intentional loading, error, and empty states.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('barbersContainer');
    if (!container) return;

    try {
        const res = await window.api.get('/barbers');
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            const activeBarbers = res.data.filter(b => b.status === 'active' || b.status === 1);
            if (activeBarbers.length > 0) {
                container.innerHTML = activeBarbers.map(barber => {
                    const imagePath = barber.image || `assets/images/barber-${barber.id}.jpg`;
                    const name = window.escapeHtml(barber.name);
                    const specialty = window.escapeHtml(barber.specialty || 'Barber Specialist');
                    const bio = window.escapeHtml(barber.bio || 'Dedicated to precision grooming and timeless styling.');
                    return `
                        <article class="barber-card">
                            <div class="barber-image">
                                <img src="${window.escapeHtml(imagePath)}" alt="${name} - ${specialty}">
                            </div>
                            <div class="barber-info">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                                    <div>
                                        <h3>${name}</h3>
                                        <span>${specialty}</span>
                                    </div>
                                    <span class="badge badge-confirmed">Active</span>
                                </div>
                                <p style="font-size: 14px; color: #5d6859; margin: 12px 0 16px;">
                                    ${bio}
                                </p>
                                <a href="booking.html?barber_id=${barber.id}" class="btn btn-sm btn-outline btn-block">
                                    Book with ${name.split(' ')[0]}
                                </a>
                            </div>
                        </article>
                    `;
                }).join('');
            } else {
                container.innerHTML = '<p class="api-state">No barbers are currently available.</p>';
            }
        } else if (res.success) {
            container.innerHTML = '<p class="api-state">No barbers are currently available.</p>';
        } else {
            container.innerHTML = `<p class="api-state api-state-error">${window.escapeHtml(res.message || 'We couldn’t load our barbers. Please try again.')}</p>`;
        }
    } catch (err) {
        container.innerHTML = '<p class="api-state api-state-error">We couldn’t load our barbers. Please try again.</p>';
    }
});
