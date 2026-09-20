/**
 * Yankiii Barber Co. — Main Client Script
 * Handles navigation, mobile drawer, auth state in header, image fallback placeholders,
 * and global toast notifications.
 */

// Global Toast Notification Helper
window.showToast = function (message, type = 'info', duration = 3500) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-triangle-exclamation';

    const iconEl = document.createElement('i');
    iconEl.className = `fa-solid ${icon}`;
    const messageEl = document.createElement('span');
    messageEl.textContent = message;
    toast.append(iconEl, messageEl);

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
};

window.escapeHtml = function (value) {
    const holder = document.createElement('div');
    holder.textContent = value == null ? '' : String(value);
    return holder.innerHTML;
};

// SVG Placeholder generator for missing images
function generateImageFallback(altText = 'Yankiii Barber Co.') {
    const encodedAlt = encodeURIComponent(altText);
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
        <defs>
            <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="%232D3A2A"/>
                <stop offset="100%" stop-color="%231a2418"/>
            </linearGradient>
        </defs>
        <rect width="600" height="600" fill="url(%23g)"/>
        <circle cx="300" cy="270" r="80" fill="%234A6E3D" opacity="0.35"/>
        <g fill="%23A7C99B" transform="translate(260, 230) scale(1.6)">
            <path d="M9.5 0a3.5 3.5 0 0 0-3.5 3.5c0 1.2.6 2.3 1.5 2.9L3 11l-1.5-1.5a2.5 2.5 0 1 0-1 1l2.5 2.5a1 1 0 0 0 1.4 0l4.5-4.5a3.5 3.5 0 1 0 .6-8.5zM2.5 13a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm7-8a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>
        </g>
        <text x="300" y="380" font-family="'Playfair Display', serif" font-size="24" font-weight="700" fill="%23FFFFFF" text-anchor="middle">YANKIII BARBER CO.</text>
        <text x="300" y="415" font-family="'DM Sans', sans-serif" font-size="14" font-weight="500" fill="%23A7C99B" text-anchor="middle" letter-spacing="2">${encodedAlt}</text>
    </svg>`;
}

// Global Image Error Handler (Fallback to brand SVG placeholder)
document.addEventListener('error', function (e) {
    if (e.target.tagName === 'IMG') {
        const img = e.target;
        if (!img.dataset.hasFallback) {
            img.dataset.hasFallback = 'true';
            img.src = generateImageFallback(img.alt || 'Grooming & Cuts');
            img.style.objectFit = 'cover';
        }
    }
}, true);

// Initialize Navigation & Authentication Header State
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle');
    const navbar = document.getElementById('navbar');

    // Mobile menu toggle
    if (menuToggle && navbar) {
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.setAttribute('aria-label', 'Toggle Navigation Menu');

        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = navbar.classList.toggle('active');
            menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            menuToggle.innerHTML = isOpen 
                ? '<i class="fa-solid fa-xmark"></i>' 
                : '<i class="fa-solid fa-bars"></i>';
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!navbar.contains(e.target) && !menuToggle.contains(e.target)) {
                navbar.classList.remove('active');
                menuToggle.setAttribute('aria-expanded', 'false');
                menuToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && navbar.classList.contains('active')) {
                navbar.classList.remove('active');
                menuToggle.setAttribute('aria-expanded', 'false');
                menuToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
            }
        });

        // Close on nav link click
        navbar.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navbar.classList.remove('active');
                menuToggle.setAttribute('aria-expanded', 'false');
                menuToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
            });
        });
    }

    // Active page indicator
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.navbar a').forEach(link => {
        const href = link.getAttribute('href');
        if (href && (href === currentPath || (currentPath === '' && href === 'index.html'))) {
            link.classList.add('active');
        } else if (href && !href.startsWith('#') && href !== currentPath) {
            link.classList.remove('active');
        }
    });

    // Update Auth State in Navbar
    updateNavbarAuth();
});

// Update Navbar Authentication State dynamically
window.updateNavbarAuth = function () {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    // Remove existing auth elements if any
    const existingAuth = navbar.querySelector('.nav-auth-item');
    if (existingAuth) existingAuth.remove();

    const token = localStorage.getItem('ybc_token');
    const userJson = localStorage.getItem('ybc_user');

    const authContainer = document.createElement('div');
    authContainer.className = 'nav-auth-item';
    authContainer.style.display = 'inline-flex';
    authContainer.style.alignItems = 'center';
    authContainer.style.gap = '14px';

    if (token && userJson) {
        try {
            const user = JSON.parse(userJson);
            const isCustomer = user.role === 'customer';
            const portalUrl = isCustomer ? 'dashboard.html' : 'admin/dashboard.html';
            const portalLabel = isCustomer ? 'My Account' : 'Admin Portal';

            authContainer.innerHTML = `
                <a href="${portalUrl}" class="nav-user-btn">
                    <i class="fa-regular fa-user"></i>
                    <span>${window.escapeHtml(user.name.split(' ')[0])}</span>
                </a>
                <button type="button" onclick="logoutUser()" class="nav-auth-link" style="background:none;border:none;cursor:pointer;font-family:inherit;">
                    <i class="fa-solid fa-arrow-right-from-bracket"></i>
                </button>
            `;
        } catch (e) {
            localStorage.removeItem('ybc_token');
            localStorage.removeItem('ybc_user');
            renderGuestLinks(authContainer);
        }
    } else {
        renderGuestLinks(authContainer);
    }

    // Insert before "Book Now" CTA
    const bookNowLink = navbar.querySelector('.nav-book');
    if (bookNowLink) {
        navbar.insertBefore(authContainer, bookNowLink);
    } else {
        navbar.appendChild(authContainer);
    }
};

function renderGuestLinks(container) {
    container.innerHTML = `
        <a href="login.html" class="nav-auth-link">Sign In</a>
    `;
}

// Global Logout function
window.logoutUser = function () {
    localStorage.removeItem('ybc_token');
    localStorage.removeItem('ybc_user');
    window.showToast('You have been logged out.', 'info');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 600);
};
