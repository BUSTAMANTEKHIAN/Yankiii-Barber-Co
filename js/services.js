/**
 * Yankiii Barber Co. — Services Catalog Script
 * Fetches dynamic services from the API when available,
 * with intentional loading, error, and empty states.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('servicesContainer');
    if (!container) return;

    try {
        const res = await window.api.get('/services');
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            // Only render active services
            const activeServices = res.data.filter(s => s.status === 'active' || s.status === 1);
            if (activeServices.length > 0) {
                container.innerHTML = activeServices.map(service => {
                    const imagePath = service.image || `assets/images/service-${service.id}.jpg`;
                    const name = window.escapeHtml(service.name);
                    const description = window.escapeHtml(service.description || 'Precision barbering service.');
                    return `
                        <article class="service-card">
                            <div class="service-image">
                                <img src="${window.escapeHtml(imagePath)}" alt="${name}">
                            </div>
                            <div class="service-content">
                                <div class="service-top">
                                    <h3>${name}</h3>
                                    <span>₱${Number(service.price).toLocaleString()}</span>
                                </div>
                                <p>${description}</p>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px;">
                                    <span class="duration"><i class="fa-regular fa-clock"></i> ${service.duration} min</span>
                                    <a href="booking.html?service_id=${service.id}" class="btn btn-sm btn-outline">Book Service</a>
                                </div>
                            </div>
                        </article>
                    `;
                }).join('');
            } else {
                container.innerHTML = '<p class="api-state">No services are currently available.</p>';
            }
        } else if (res.success) {
            container.innerHTML = '<p class="api-state">No services are currently available.</p>';
        } else {
            container.innerHTML = `<p class="api-state api-state-error">${window.escapeHtml(res.message || 'We couldn’t load our services. Please try again.')}</p>`;
        }
    } catch (err) {
        container.innerHTML = '<p class="api-state api-state-error">We couldn’t load our services. Please try again.</p>';
    }
});
