
const express = require('express');
const nodemailer = require('nodemailer');

const router = express.Router();

const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 465),
    secure: process.env.MAIL_SECURE === 'true',
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD
    }
});

router.post('/', async (req, res) => {
    try {
        const {
            name,
            email,
            subject,
            message
        } = req.body;

        // Validate required fields
        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'Please fill out all required fields.'
            });
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid email address.'
            });
        }

        // Send email to your Gmail
        await transporter.sendMail({
            from: `"Yankiii Barber Co. Website" <${process.env.MAIL_USER}>`,
            to: process.env.MAIL_USER,
            replyTo: email,
            subject: `Contact Form: ${subject}`,

            text: `
YANKIII BARBER CO.
NEW CONTACT MESSAGE
==============================

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}

==============================
This message was sent through the
Yankiii Barber Co. website contact form.
            `.trim(),

            html: `
                <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; color: #1f2937;">

                    <div style="background: #1f2a1f; padding: 25px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">
                            YANKIII BARBER CO.
                        </h1>
                        <p style="color: #d7e0d2; margin: 8px 0 0;">
                            New Contact Message
                        </p>
                    </div>

                    <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb;">

                        <h2 style="margin-top: 0;">
                            Someone sent you a message
                        </h2>

                        <div style="margin: 20px 0;">

                            <p>
                                <strong>Name:</strong><br>
                                ${escapeHtml(name)}
                            </p>

                            <p>
                                <strong>Email:</strong><br>
                                ${escapeHtml(email)}
                            </p>

                            <p>
                                <strong>Subject:</strong><br>
                                ${escapeHtml(subject)}
                            </p>

                        </div>

                        <div style="
                            background: #f5f7f3;
                            border-left: 4px solid #088178;
                            padding: 18px;
                            margin-top: 25px;
                        ">
                            <strong>Message:</strong>

                            <p style="
                                white-space: pre-wrap;
                                line-height: 1.6;
                                margin-bottom: 0;
                            ">
                                ${escapeHtml(message)}
                            </p>
                        </div>

                        <p style="
                            margin-top: 30px;
                            font-size: 13px;
                            color: #6b7280;
                        ">
                            This message was sent through the
                            Yankiii Barber Co. website contact form.
                        </p>

                    </div>

                </div>
            `
        });

        console.log(`📧 Contact message received from ${email}`);

        return res.status(200).json({
            success: true,
            message: 'Your message has been sent successfully.'
        });

    } catch (error) {

        console.error('❌ Contact Email Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to send your message right now. Please try again later.'
        });
    }
});


/**
 * Escape HTML characters to prevent
 * user-submitted content from becoming HTML.
 */
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


module.exports = router;