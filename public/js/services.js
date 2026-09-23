/**
 * Yankiii Barber Co.
 * Dynamic Services Catalog
 */

'use strict';

(function () {

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function getImagePath(image, id) {

        const fallback =
            `/assets/images/service-${id}.jpg`;

        if (!image || !String(image).trim()) {
            return fallback;
        }

        let src =
            String(image).trim();

        if (
            src.startsWith('http://') ||
            src.startsWith('https://') ||
            src.startsWith('data:')
        ) {
            return src;
        }

        src =
            src.replace(/\\/g, '/');

        if (src.startsWith('public/')) {
            src =
                src.substring(7);
        }

        if (!src.startsWith('/')) {
            src =
                '/' + src;
        }

        return src;
    }

    async function loadServices() {

        const container =
            document.getElementById(
                'servicesContainer'
            );

        if (!container) {
            return;
        }

        container.innerHTML = `
            <div
                class="api-state"
                style="grid-column:1/-1;"
            >
                <i class="fa-solid fa-spinner fa-spin"></i>
                Loading services...
            </div>
        `;

        try {

            const response =
                await window.api.get('/services');

            if (
                !response.success ||
                !Array.isArray(response.data)
            ) {
                throw new Error(
                    response.message ||
                    'Unable to load services.'
                );
            }

            const services =
                response.data.filter(service =>
                    service.status === 'active' ||
                    service.status === 1
                );

            if (!services.length) {

                container.innerHTML = `
                    <div
                        class="api-state"
                        style="grid-column:1/-1;"
                    >
                        No services are currently available.
                    </div>
                `;

                return;
            }

            container.innerHTML =
                services.map(service => {

                    const image =
                        getImagePath(
                            service.image,
                            service.id
                        );

                    const name =
                        escapeHtml(service.name);

                    const description =
                        escapeHtml(
                            service.description ||
                            'Professional grooming service.'
                        );

                    const price =
                        Number(
                            service.price || 0
                        ).toLocaleString(
                            'en-PH'
                        );

                    const duration =
                        Number(
                            service.duration || 30
                        );

                    return `
                        <article class="service-card">

                            <div class="service-image">

                                <img
                                    src="${escapeHtml(image)}"
                                    alt="${name}"
                                    loading="lazy"
                                    onerror="this.onerror=null;this.src='/assets/images/service-${Number(service.id)}.jpg';"
                                >

                            </div>

                            <div class="service-content">

                                <div class="service-top">

                                    <h3>
                                        ${name}
                                    </h3>

                                    <span>
                                        ₱${price}
                                    </span>

                                </div>

                                <p>
                                    ${description}
                                </p>

                                <div
                                    style="
                                        display:flex;
                                        justify-content:space-between;
                                        align-items:center;
                                        margin-top:16px;
                                    "
                                >

                                    <span
                                        style="
                                            font-size:13px;
                                            color:#65705f;
                                        "
                                    >
                                        <i class="fa-regular fa-clock"></i>
                                        ${duration} mins
                                    </span>

                                    <a
                                        href="booking.html?service_id=${encodeURIComponent(service.id)}"
                                        class="text-link"
                                        onclick="return requireBookingLogin(event)"
                                    >
                                        Book now
                                        <i class="fa-solid fa-arrow-right"></i>
                                    </a>

                                </div>

                            </div>

                        </article>
                    `;

                }).join('');

        } catch (error) {

            console.error(
                'Service loading error:',
                error
            );

            container.innerHTML = `
                <div
                    class="api-state api-state-error"
                    style="grid-column:1/-1;"
                >
                    Unable to load services.
                    Please refresh the page.
                </div>
            `;
        }
    }

    document.addEventListener(
        'DOMContentLoaded',
        loadServices
    );

})();