/**
 * Yankiii Barber Co. — Centralized API Client
 * Wraps fetch calls with auth headers, base URL handling, error resilience,
 * and unified responses.
 */

const API_CONFIG = {
    // Automatically uses current origin in production or http://localhost:3000 in dev if needed
    BASE_URL: (window.location.port === '3000' || window.location.port === '8080')
        ? '/api' 
        : (window.location.protocol === 'file:' ? 'http://localhost:3000/api' : '/api')
};

const api = {
    getToken() {
        return localStorage.getItem('ybc_token');
    },

    getUser() {
        try {
            return JSON.parse(localStorage.getItem('ybc_user'));
        } catch (e) {
            return null;
        }
    },

    getHeaders(customHeaders = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...customHeaders
        };
        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    },

    async request(endpoint, options = {}) {
        const url = `${API_CONFIG.BASE_URL}${endpoint}`;
        const config = {
            ...options,
            headers: this.getHeaders(options.headers)
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                // If unauthorized and not on login page, optionally handle session expiry
                if (response.status === 401 && !window.location.pathname.includes('login.html')) {
                    // A rejected token must never leave the UI appearing authenticated.
                    localStorage.removeItem('ybc_token');
                    localStorage.removeItem('ybc_user');
                    if (window.location.pathname.includes('dashboard') || window.location.pathname.includes('/admin/')) {
                        window.location.href = window.location.pathname.includes('/admin/') ? '../login.html' : 'login.html';
                    }
                }
                return {
                    success: false,
                    status: response.status,
                    message: data.message || 'An unexpected error occurred. Please try again.',
                    errors: data.errors || null
                };
            }

            return {
                success: true,
                status: response.status,
                data: data.data !== undefined ? data.data : data,
                message: data.message || null
            };
        } catch (error) {
            console.warn(`API Connection Warning for [${endpoint}]:`, error.message);
            return {
                success: false,
                status: 0,
                message: 'Unable to connect to server. Please check your connection or ensure backend is running.'
            };
        }
    },

    get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    },

    post(endpoint, body, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: JSON.stringify(body)
        });
    },

    put(endpoint, body, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(body)
        });
    },

    patch(endpoint, body, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PATCH',
            body: JSON.stringify(body)
        });
    },

    delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }
};

window.api = api;
