/**
 * Yankiii Barber Co.
 * Homepage Dynamic Barbers
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
            `/assets/images/barber-${id}.jpg`;

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

    async function loadHomeBarbers() {

        const container =
            document.getElementById(
                'homeBarbersContainer'
            );

        if (!container) {
            return;
        }

        try {

            const response =
                await window.api.get('/barbers');

            if (
                !response.success ||
                !Array.isArray(response.data)
            ) {
                throw new Error(
                    response.message ||
                    'Unable to load barbers.'
                );
            }

            const barbers =
                response.data
                    .filter(barber =>
                        barber.status === 'active' ||
                        barber.status === 1
                    )
                    .slice(0, 3);

            if (!barbers.length) {

                container.innerHTML = `
                    <div
                        class="api-state"
                        style="grid-column:1/-1;"
                    >
                        No barbers available.
                    </div>
                `;

                return;
            }

            container.innerHTML =
                barbers.map(barber => {

                    const image =
                        getImagePath(
                            barber.image,
                            barber.id
                        );

                    const name =
                        escapeHtml(barber.name);

                    const specialty =
                        escapeHtml(
                            barber.specialty ||
                            'Professional Barber'
                        );

                    const bio =
                        escapeHtml(
                            barber.bio ||
                            'Professional grooming services.'
                        );

                    return `
                        <article class="barber-card">

                            <div class="barber-image">

                                <img
                                    src="${escapeHtml(image)}"
                                    alt="${name}"
                                    loading="lazy"
                                    onerror="this.onerror=null;this.src='/assets/images/barber-${Number(barber.id)}.jpg';"
                                >

                            </div>

                            <div class="barber-info">

                                <h3>
                                    ${name}
                                </h3>

                                <span>
                                    ${specialty}
                                </span>

                                <p>
                                    ${bio}
                                </p>

                                <a
                                    href="booking.html?barber_id=${encodeURIComponent(barber.id)}"
                                    class="btn btn-sm btn-outline btn-block"
                                    onclick="return requireBookingLogin(event)"
                                >
                                    Book with ${name}
                                </a>

                            </div>

                        </article>
                    `;

                }).join('');

        } catch (error) {

            console.error(
                'Homepage barber loading error:',
                error
            );

            container.innerHTML = `
                <div
                    class="api-state api-state-error"
                    style="grid-column:1/-1;"
                >
                    Unable to load our barbers.
                </div>
            `;
        }
    }

    document.addEventListener(
        'DOMContentLoaded',
        loadHomeBarbers
    );

})();