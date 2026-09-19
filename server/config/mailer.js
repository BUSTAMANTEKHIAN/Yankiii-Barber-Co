const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT) || 465,
    secure: process.env.MAIL_SECURE === 'true',

    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD
    },

    tls: {
        minVersion: 'TLSv1.2'
    },

    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000
});

async function verifyMailer() {
    try {
        await transporter.verify();
        console.log('📧 Gmail SMTP connection verified successfully.');
        return true;
    } catch (error) {
        console.error('❌ Gmail SMTP verification failed:');
        console.error(error);
        return false;
    }
}

async function sendMail({ to, subject, html, text }) {
    return transporter.sendMail({
        from: `"Yankiii Barber Co." <${process.env.MAIL_USER}>`,
        to,
        subject,
        text,
        html
    });
}

module.exports = {
    transporter,
    verifyMailer,
    sendMail
};