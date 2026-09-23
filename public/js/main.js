/**
 * Yankiii Barber Co. — Main Client Script
 *
 * Handles:
 * - Global toast notifications
 * - HTML escaping
 * - Image fallbacks
 * - Mobile navigation
 * - Active navigation state
 * - Authentication state
 * - Logout
 */

'use strict';



/* =========================================================
   GLOBAL TOAST
========================================================= */

window.showToast = function (
    message,
    type = 'info',
    duration = 3500
) {

    let container =
        document.getElementById(
            'toastContainer'
        );


    if (!container) {

        container =
            document.createElement(
                'div'
            );

        container.id =
            'toastContainer';

        container.className =
            'toast-container';

        document.body.appendChild(
            container
        );

    }


    const toast =
        document.createElement(
            'div'
        );


    toast.className =
        `toast toast-${type}`;


    let icon =
        'fa-circle-info';


    if (type === 'success') {

        icon =
            'fa-circle-check';

    }


    if (type === 'error') {

        icon =
            'fa-triangle-exclamation';

    }


    const iconElement =
        document.createElement(
            'i'
        );


    iconElement.className =
        `fa-solid ${icon}`;


    const messageElement =
        document.createElement(
            'span'
        );


    messageElement.textContent =
        message;


    toast.append(
        iconElement,
        messageElement
    );


    container.appendChild(
        toast
    );


    setTimeout(() => {

        toast.style.opacity =
            '0';

        toast.style.transform =
            'translateY(10px)';


        setTimeout(() => {

            toast.remove();

        }, 300);

    }, duration);

};



/* =========================================================
   HTML ESCAPE HELPER
========================================================= */

window.escapeHtml = function (
    value
) {

    const holder =
        document.createElement(
            'div'
        );


    holder.textContent =
        value == null
            ? ''
            : String(value);


    return holder.innerHTML;

};



/* =========================================================
   IMAGE FALLBACK
========================================================= */

function generateImageFallback(
    altText = 'Yankiii Barber Co.'
) {

    const encodedAlt =
        encodeURIComponent(
            altText
        );


    return `
        data:image/svg+xml;utf8,

        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="600"
            height="600"
            viewBox="0 0 600 600"
        >

            <defs>

                <linearGradient
                    id="g"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                >

                    <stop
                        offset="0%"
                        stop-color="%232D3A2A"
                    />

                    <stop
                        offset="100%"
                        stop-color="%231a2418"
                    />

                </linearGradient>

            </defs>


            <rect
                width="600"
                height="600"
                fill="url(%23g)"
            />


            <circle
                cx="300"
                cy="270"
                r="80"
                fill="%234A6E3D"
                opacity="0.35"
            />


            <g
                fill="%23A7C99B"
                transform="translate(260, 230) scale(1.6)"
            >

                <path
                    d="M9.5 0a3.5 3.5 0 0 0-3.5 3.5c0 1.2.6 2.3 1.5 2.9L3 11l-1.5-1.5a2.5 2.5 0 1 0-1 1l2.5 2.5a1 1 0 0 0 1.4 0l4.5-4.5a3.5 3.5 0 1 0 .6-8.5zM2.5 13a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm7-8a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
                />

            </g>


            <text
                x="300"
                y="380"
                font-family="'Playfair Display', serif"
                font-size="24"
                font-weight="700"
                fill="%23FFFFFF"
                text-anchor="middle"
            >
                YANKIII BARBER CO.
            </text>


            <text
                x="300"
                y="415"
                font-family="'DM Sans', sans-serif"
                font-size="14"
                font-weight="500"
                fill="%23A7C99B"
                text-anchor="middle"
                letter-spacing="2"
            >
                ${encodedAlt}
            </text>

        </svg>
    `;

}



/* =========================================================
   GLOBAL IMAGE ERROR HANDLER
========================================================= */

document.addEventListener(
    'error',
    event => {

        if (
            event.target.tagName !==
            'IMG'
        ) {

            return;

        }


        const image =
            event.target;


        if (
            image.dataset.hasFallback
        ) {

            return;

        }


        image.dataset.hasFallback =
            'true';


        image.src =
            generateImageFallback(
                image.alt ||
                'Grooming & Cuts'
            );


        image.style.objectFit =
            'cover';

    },
    true
);



/* =========================================================
   DOM INITIALIZATION
========================================================= */

document.addEventListener(
    'DOMContentLoaded',
    () => {

        initMobileNavigation();

        updateActiveNavigation();

        updateNavbarAuth();

    }
);



/* =========================================================
   MOBILE NAVIGATION
========================================================= */

function initMobileNavigation() {

    const menuToggle =
        document.getElementById(
            'menuToggle'
        );

    const navbar =
        document.getElementById(
            'navbar'
        );


    if (
        !menuToggle ||
        !navbar
    ) {

        return;

    }


    menuToggle.setAttribute(
        'aria-expanded',
        'false'
    );


    menuToggle.addEventListener(
        'click',
        event => {

            event.stopPropagation();


            const isOpen =
                navbar.classList.toggle(
                    'active'
                );


            menuToggle.setAttribute(
                'aria-expanded',
                isOpen
                    ? 'true'
                    : 'false'
            );


            menuToggle.innerHTML =
                isOpen
                    ? '<i class="fa-solid fa-xmark"></i>'
                    : '<i class="fa-solid fa-bars"></i>';

        }
    );



    document.addEventListener(
        'click',
        event => {

            if (
                !navbar.contains(
                    event.target
                ) &&
                !menuToggle.contains(
                    event.target
                )
            ) {

                closeMobileNavigation();

            }

        }
    );



    document.addEventListener(
        'keydown',
        event => {

            if (
                event.key === 'Escape' &&
                navbar.classList.contains(
                    'active'
                )
            ) {

                closeMobileNavigation();

            }

        }
    );



    navbar
        .querySelectorAll('a')
        .forEach(link => {

            link.addEventListener(
                'click',
                () => {

                    closeMobileNavigation();

                }
            );

        });



    function closeMobileNavigation() {

        navbar.classList.remove(
            'active'
        );


        menuToggle.setAttribute(
            'aria-expanded',
            'false'
        );


        menuToggle.innerHTML =
            '<i class="fa-solid fa-bars"></i>';

    }

}



/* =========================================================
   ACTIVE NAVIGATION
========================================================= */

function updateActiveNavigation() {

    const currentPath =
        window.location.pathname
            .split('/')
            .pop() ||
        'index.html';


    document
        .querySelectorAll(
            '.navbar a'
        )
        .forEach(link => {

            const href =
                link.getAttribute(
                    'href'
                );


            if (!href) return;


            const cleanHref =
                href.split('?')[0];


            if (
                cleanHref ===
                currentPath
            ) {

                link.classList.add(
                    'active'
                );

            } else if (
                !cleanHref.startsWith('#')
            ) {

                link.classList.remove(
                    'active'
                );

            }

        });

}



/* =========================================================
   NAVBAR AUTHENTICATION
========================================================= */

window.updateNavbarAuth =
    function () {

        const navbar =
            document.getElementById(
                'navbar'
            );


        if (!navbar) return;


        const existingAuth =
            navbar.querySelector(
                '.nav-auth-item'
            );


        if (existingAuth) {

            existingAuth.remove();

        }


        const token =
            localStorage.getItem(
                'ybc_token'
            );


        const userJson =
            localStorage.getItem(
                'ybc_user'
            );


        const authContainer =
            document.createElement(
                'div'
            );


        authContainer.className =
            'nav-auth-item';


        authContainer.style.display =
            'inline-flex';


        authContainer.style.alignItems =
            'center';


        authContainer.style.gap =
            '14px';



        if (
            token &&
            userJson
        ) {

            try {

                const user =
                    JSON.parse(
                        userJson
                    );


                const isCustomer =
                    user.role ===
                    'customer';


                const portalUrl =
                    isCustomer
                        ? 'dashboard.html'
                        : 'admin/dashboard.html';


                const portalLabel =
                    isCustomer
                        ? 'My Account'
                        : 'Admin Portal';


                const firstName =
                    String(
                        user.name ||
                        'Account'
                    )
                    .trim()
                    .split(/\s+/)[0];


                authContainer.innerHTML = `

                    <a
                        href="${portalUrl}"
                        class="nav-user-btn"
                        aria-label="${portalLabel}"
                    >

                        <i
                            class="fa-regular fa-user"
                        ></i>

                        <span>
                            ${window.escapeHtml(firstName)}
                        </span>

                    </a>


                    <button
                        type="button"
                        class="nav-auth-link"
                        onclick="logoutUser()"
                        aria-label="Log out"
                        style="
                            background:none;
                            border:none;
                            cursor:pointer;
                            font-family:inherit;
                        "
                    >

                        <i
                            class="fa-solid fa-arrow-right-from-bracket"
                        ></i>

                    </button>

                `;

            } catch (error) {

                console.error(
                    'Invalid stored user:',
                    error
                );


                clearStoredAuth();

                renderGuestLinks(
                    authContainer
                );

            }

        } else {

            renderGuestLinks(
                authContainer
            );

        }



        const bookNowLink =
            navbar.querySelector(
                '.nav-book'
            );


        if (bookNowLink) {

            navbar.insertBefore(
                authContainer,
                bookNowLink
            );

        } else {

            navbar.appendChild(
                authContainer
            );

        }

    };



/* =========================================================
   GUEST AUTH LINKS
========================================================= */

function renderGuestLinks(
    container
) {

    container.innerHTML = `

        <a
            href="login.html"
            class="nav-auth-link"
        >
            Sign In
        </a>

    `;

}



/* =========================================================
   AUTH CLEANUP
========================================================= */

function clearStoredAuth() {

    localStorage.removeItem(
        'ybc_token'
    );

    localStorage.removeItem(
        'ybc_user'
    );

}



/* =========================================================
   LOGOUT
========================================================= */

window.logoutUser =
    function () {

        clearStoredAuth();


        window.showToast(
            'You have been logged out.',
            'info'
        );


        setTimeout(() => {

            window.location.href =
                'index.html';

        }, 600);

    };