/**
 * Yankiii Barber Co. — Authentication Controller
 * Handles customer/admin registration, login, profile queries, and password hashing.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const crypto = require('crypto');
const { sendMail } = require('../config/mailer');
const { JWT_SECRET } = require('../middleware/authMiddleware');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function register(req, res) {
    try {
        const { name, email, phone, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and password are required.'
            });
        }

        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address.'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long.'
            });
        }

        // Check if user already exists
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'An account with this email address already exists.'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert new user
        const [result] = await pool.query(
            'INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)',
            [name.trim(), email.toLowerCase().trim(), hashedPassword, phone ? phone.trim() : null, 'customer']
        );

        const newUserId = result.insertId;
        const userPayload = {
            id: newUserId,
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone || null,
            role: 'customer'
        };

        const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

        return res.status(201).json({
            success: true,
            message: 'Account registered successfully.',
            data: {
                token,
                user: userPayload
            }
        });
    } catch (err) {
        console.error('Registration Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Unable to register account. Please try again.'
        });
    }
}

async function login(req, res) {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== 'string' ||
            typeof password !== 'string' ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required.'
            });
        }

        // Retrieve user
        const [rows] = await pool.query(
            'SELECT id, name, email, password, phone, role FROM users WHERE email = ?',
            [email.toLowerCase().trim()]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        const user = rows[0];

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        const userPayload = {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role
        };

        const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

        return res.status(200).json({
            success: true,
            message: 'Signed in successfully.',
            data: {
                token,
                user: userPayload
            }
        });
    } catch (err) {
        console.error('Login Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Unable to sign in. Please try again.'
        });
    }
}

async function getMe(req, res) {
    try {
        const [rows] = await pool.query(
            'SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?',
            [req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User profile not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: rows[0]
        });
    } catch (err) {
        console.error('GetMe Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve user profile.'
        });
    }
}

async function updateProfile(req, res) {
    try {
        const { name, phone, password } = req.body;
        const updates = [];
        const params = [];

        if (name) {
            updates.push('name = ?');
            params.push(name.trim());
        }
        if (phone !== undefined) {
            updates.push('phone = ?');
            params.push(phone.trim());
        }
        if (password) {
            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Password must be at least 6 characters.'
                });
            }
            const salt = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(password, salt);
            updates.push('password = ?');
            params.push(hashed);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No changes provided.'
            });
        }

        params.push(req.user.id);
        await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully.'
        });
    } catch (err) {
        console.error('UpdateProfile Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Unable to update profile.'
        });
    }
}

async function forgotPassword(req, res) {
    try {
        const { email } = req.body;

        if (!email || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Email address is required.'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const [users] = await pool.query(
            `SELECT id, name, email
             FROM users
             WHERE email = ?
             LIMIT 1`,
            [normalizedEmail]
        );

        /*
         * Use the same response whether the email exists or not.
         * This prevents users from discovering which emails
         * are registered in the system.
         */
        if (users.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'If an account with that email exists, a verification code has been sent.'
            });
        }

        const user = users[0];

        // Generate a secure 6-digit verification code.
        const verificationCode = crypto
            .randomInt(100000, 1000000)
            .toString();

        // Store only the hashed code in the database.
        const codeHash = await bcrypt.hash(verificationCode, 10);

        // Code expires after 10 minutes.
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Remove previous reset codes for this user.
        await pool.query(
            `DELETE FROM password_resets
             WHERE user_id = ?`,
            [user.id]
        );

        // Save the new reset request.
        await pool.query(
            `INSERT INTO password_resets
             (user_id, email, code_hash, expires_at, attempts)
             VALUES (?, ?, ?, ?, 0)`,
            [
                user.id,
                user.email,
                codeHash,
                expiresAt
            ]
        );

        // Send the verification code to the user's email.
        await sendMail({
            to: user.email,
            subject: 'Yankiii Barber Co. — Password Reset Code',

            text:
                `Your Yankiii Barber Co. password reset code is ${verificationCode}. ` +
                `This code expires in 10 minutes.`,

            html: `
                <div style="
                    font-family: Arial, sans-serif;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                ">
                    <h2>Yankiii Barber Co.</h2>

                    <p>Hello ${user.name || 'there'},</p>

                    <p>
                        We received a request to reset your password.
                    </p>

                    <p>Your verification code is:</p>

                    <div style="
                        font-size: 32px;
                        font-weight: bold;
                        letter-spacing: 8px;
                        padding: 20px;
                        background: #f5f5f5;
                        text-align: center;
                        margin: 20px 0;
                    ">
                        ${verificationCode}
                    </div>

                    <p>
                        This code will expire in
                        <strong>10 minutes</strong>.
                    </p>

                    <p>
                        If you did not request a password reset,
                        you can safely ignore this email.
                    </p>

                    <p>
                        — Yankiii Barber Co.
                    </p>
                </div>
            `
        });

        return res.status(200).json({
            success: true,
            message: 'If an account with that email exists, a verification code has been sent.'
        });

    } catch (err) {
        console.error('Forgot Password Error:', err);

        return res.status(500).json({
            success: false,
            message: 'Unable to process the password reset request.'
        });
    }
}

async function verifyResetCode(req, res) {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({
                success: false,
                message: 'Email and verification code are required.'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (!/^\d{6}$/.test(code)) {
            return res.status(400).json({
                success: false,
                message: 'Verification code must be 6 digits.'
            });
        }

        const [rows] = await pool.query(
            `
            SELECT *
            FROM password_resets
            WHERE email = ?
            ORDER BY id DESC
            LIMIT 1
            `,
            [normalizedEmail]
        );

        if (rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification code.'
            });
        }

        const resetRequest = rows[0];

        // Maximum of 5 verification attempts
        if (resetRequest.attempts >= 5) {
            return res.status(429).json({
                success: false,
                message: 'Too many incorrect attempts. Please request a new code.'
            });
        }

        // Check expiration
        if (new Date(resetRequest.expires_at) < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Verification code has expired. Please request a new code.'
            });
        }

        // Check whether this code is already verified
        if (resetRequest.verified_at) {
            return res.status(400).json({
                success: false,
                message: 'This verification code has already been used.'
            });
        }

        const isValidCode = await bcrypt.compare(
            code,
            resetRequest.code_hash
        );

        if (!isValidCode) {
            await pool.query(
                `
                UPDATE password_resets
                SET attempts = attempts + 1
                WHERE id = ?
                `,
                [resetRequest.id]
            );

            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification code.'
            });
        }

        /*
         * Generate a secure random reset token.
         * The raw token is sent to the browser.
         * Only its SHA-256 hash is stored in the database.
         */
        const resetToken = crypto.randomBytes(32).toString('hex');

        const resetTokenHash = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');

        await pool.query(
            `
            UPDATE password_resets
            SET
                reset_token_hash = ?,
                verified_at = NOW()
            WHERE id = ?
            `,
            [resetTokenHash, resetRequest.id]
        );

        return res.status(200).json({
            success: true,
            message: 'Verification code confirmed.',
            resetToken
        });

    } catch (error) {
        console.error('Verify Reset Code Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to verify the code right now.'
        });
    }
}

async function resetPassword(req, res) {
    try {
        const { email, resetToken, newPassword } = req.body;

        if (!email || !resetToken || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Email, reset token, and new password are required.'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (typeof resetToken !== 'string' || resetToken.length !== 64) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired password reset session.'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long.'
            });
        }

        // Hash the token received from the browser.
        // Only the hash is stored in the database.
        const resetTokenHash = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');

        const [rows] = await pool.query(
            `
            SELECT *
            FROM password_resets
            WHERE email = ?
              AND reset_token_hash = ?
            ORDER BY id DESC
            LIMIT 1
            `,
            [normalizedEmail, resetTokenHash]
        );

        if (rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired password reset session.'
            });
        }

        const resetRequest = rows[0];

        // Make sure the verification step was completed.
        if (!resetRequest.verified_at) {
            return res.status(400).json({
                success: false,
                message: 'Please verify your code first.'
            });
        }

        // Make sure the reset request has not expired.
        if (new Date(resetRequest.expires_at) < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Password reset session has expired. Please request a new code.'
            });
        }

        // Hash the new password securely.
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update the user's password.
        await pool.query(
            `
            UPDATE users
            SET password = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            `,
            [hashedPassword, resetRequest.user_id]
        );

        // Invalidate the reset token immediately.
        await pool.query(
            `
            DELETE FROM password_resets
            WHERE id = ?
            `,
            [resetRequest.id]
        );

        return res.status(200).json({
            success: true,
            message: 'Password reset successfully. You can now sign in.'
        });

    } catch (error) {
        console.error('Reset Password Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to reset your password right now.'
        });
    }
}

module.exports = {
    register,
    login,
    getMe,
    updateProfile,
    forgotPassword,
    verifyResetCode,
    resetPassword
};

