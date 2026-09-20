/**
 * Yankiii Barber Co. — Authentication Controller Script
 * Handles customer & admin registration, login, token management,
 * and redirection.
 */

window.handleLogin = async function (e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');

    if (!email || !password) {
        window.showToast('Please provide both email and password.', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing In...';

    try {
        const res = await window.api.post('/auth/login', { email, password });

        if (res.success && res.data && res.data.token) {
            localStorage.setItem('ybc_token', res.data.token);
            localStorage.setItem('ybc_user', JSON.stringify(res.data.user));

            window.showToast(`Welcome back, ${res.data.user.name.split(' ')[0]}!`, 'success');

            setTimeout(() => {
                if (res.data.user.role === 'admin') {
                    window.location.href = 'admin/dashboard.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
            }, 500);
            return;
        } else {
            window.showToast(res.message || 'Invalid email or password.', 'error');
            btn.disabled = false;
            btn.innerHTML = 'Sign In <i class="fa-solid fa-arrow-right"></i>';
        }
    } catch (err) {
        window.showToast('Unable to sign in. Please try again.', 'error');
        btn.disabled = false;
        btn.innerHTML = 'Sign In <i class="fa-solid fa-arrow-right"></i>';
    }
};

window.handleRegister = async function (e) {
    e.preventDefault();

    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const btn = document.getElementById('registerBtn');

    if (password !== confirmPassword) {
        window.showToast('Passwords do not match. Please recheck.', 'error');
        return;
    }

    if (password.length < 6) {
        window.showToast('Password must be at least 6 characters.', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating Account...';

    try {
        const res = await window.api.post('/auth/register', { name, email, phone, password });

        if (res.success && res.data && res.data.token) {
            localStorage.setItem('ybc_token', res.data.token);
            localStorage.setItem('ybc_user', JSON.stringify(res.data.user));

            window.showToast('Account created successfully!', 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 500);
            return;
        } else {
            window.showToast(res.message || 'Unable to register account.', 'error');
            btn.disabled = false;
            btn.innerHTML = 'Create Account <i class="fa-solid fa-user-plus"></i>';
        }
    } catch (err) {
        window.showToast('Unable to create your account. Please try again.', 'error');
        btn.disabled = false;
        btn.innerHTML = 'Create Account <i class="fa-solid fa-user-plus"></i>';
    }
};
