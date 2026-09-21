/**
 * Yankiii Barber Co.
 * Booking Authentication Guard
 *
 * Guests can browse the website, but an account is required
 * before accessing the appointment booking flow.
 */

(function () {
    'use strict';

    function isLoggedIn() {
        const token = localStorage.getItem('ybc_token');
        const user = localStorage.getItem('ybc_user');

        return Boolean(token && user);
    }

    function showLoginRequiredMessage() {
        if (typeof window.showToast === 'function') {
            window.showToast(
                'Please, login first before booking appointment.',
                'info'
            );
        } else {
            alert('Please, login first before booking appointment.');
        }
    }

    function redirectToRegister() {
        setTimeout(() => {
            window.location.href = 'register.html';
        }, 700);
    }

    /**
     * Used by Book Now / Book Appointment buttons.
     */
    window.requireBookingLogin = function (event) {
        if (isLoggedIn()) {
            return true;
        }

        if (event) {
            event.preventDefault();
        }

        showLoginRequiredMessage();
        redirectToRegister();

        return false;
    };

    /**
     * Protect the actual booking page.
     */
    function protectBookingPage() {
        const currentPage = window.location.pathname
            .split('/')
            .pop()
            .toLowerCase();

        if (currentPage !== 'booking.html') {
            return;
        }

        if (isLoggedIn()) {
            return;
        }

        showLoginRequiredMessage();
        redirectToRegister();
    }

    document.addEventListener('DOMContentLoaded', protectBookingPage);
})();