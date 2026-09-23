/**
 * Yankiii Barber Co.
 * Dynamic Barber Directory
 *
 * Barber information is loaded from the database API.
 * Image paths are controlled from the Admin panel.
 */

'use strict';

(function () {

    /* ==========================================
       HTML ESCAPE
    ========================================== */

    function escapeHtml(value) {

        return String(value ?? '').replace(
            /[&<>"']/g,
            char => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[char])
        );

    }


    /* ==========================================
       IMAGE PATH HANDLER
    ========================================== */

    function getImagePath(image, id) {

        const fallback =
            `/assets/images/barber-${id}.jpg`;

        if (!image || !String(image).trim()) {
            return fallback;
        }

        let src = String(image).trim();

        /*
         * Absolute URL
         */

        if (
            src.startsWith('http://') ||
            src.startsWith('https://') ||
            src.startsWith('data:')
        ) {
            return src;
        }

        /*
         * Convert Windows backslashes
         *
         * Example:
         * assets\images\barber-1.jpg
         *
         * becomes:
         * assets/images/barber-1.jpg
         */

        src = src.replace(/\\/g, '/');

        /*
         * Remove "public/" if admin entered:
         *
         * public/assets/images/barber-1.jpg
         */

        if (src.startsWith('public/')) {
            src = src.substring(7);
        }

        /*
         * Make relative paths absolute.
         *
         * assets/images/barber-1.jpg
         *
         * becomes:
         *
         * /assets/images/barber-1.jpg
         */

        if (!src.startsWith('/')) {
            src = '/' + src;
        }

        return src;

    }


    /* ==========================================
       INITIALIZE PAGE
    ========================================== */

    function initBarbersPage() {

        const container =
            document.getElementById('barbersContainer');

        if (!container) {
            return;
        }

        loadBarbers(container);

    }


    /* ==========================================
       LOAD BARBERS FROM API
    ========================================== */

    async function loadBarbers(container) {

        container.innerHTML = `
            <div
                class="api-state"
                style="grid-column:1/-1;"
            >
                <i class="fa-solid fa-spinner fa-spin"></i>
                Loading our barbers...
            </div>
        `;

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


            /*
             * Only display active barbers
             */

            const barbers =
                response.data.filter(barber =>
                    barber.status === 'active' ||
                    barber.status === 1
                );


            /*
             * No active barbers
             */

            if (barbers.length === 0) {

                container.innerHTML = `
                    <div
                        class="api-state"
                        style="grid-column:1/-1;"
                    >
                        No barbers are currently available.
                    </div>
                `;

                return;
            }


            /*
             * Build barber cards
             */

            container.innerHTML =
                barbers.map(barber => {

                    const image =
                        getImagePath(
                            barber.image,
                            barber.id
                        );


                    const name =
                        escapeHtml(
                            barber.name ||
                            'Professional Barber'
                        );


                    const specialty =
                        escapeHtml(
                            barber.specialty ||
                            'Professional Barber'
                        );


                    const bio =
                        escapeHtml(
                            barber.bio ||
                            'Professional grooming and barbering services.'
                        );


                    return `

                        <article class="barber-card">

                            <!-- BARBER IMAGE -->

                            <div class="barber-image">

                                <img
                                    src="${escapeHtml(image)}"
                                    alt="${name}"
                                    loading="lazy"

                                    onerror="
                                        this.onerror=null;
                                        this.src='/assets/images/barber-${Number(barber.id)}.jpg';
                                    "
                                >

                            </div>


                            <!-- BARBER INFORMATION -->

                            <div class="barber-info">

                                <div class="barber-card-heading">

                                    <div>

                                        <h3>
                                            ${name}
                                        </h3>

                                        <span>
                                            ${specialty}
                                        </span>

                                    </div>


                                    <span class="badge badge-confirmed">
                                        Available
                                    </span>

                                </div>


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
                'Failed to load barbers:',
                error
            );


            container.innerHTML = `

                <div
                    class="api-state api-state-error"
                    style="grid-column:1/-1;"
                >

                    Unable to load barber information.
                    Please refresh the page.

                </div>

            `;

        }

    }


    /* ==========================================
       START
    ========================================== */

    document.addEventListener(
        'DOMContentLoaded',
        initBarbersPage
    );

})();