/**
 * Yankiii Barber Co. — Booking Engine Utilities
 * Implements slot calculation, duration overlap evaluation, and reference generation.
 */

/**
 * Converts "HH:mm" or "HH:mm:ss" string to total minutes since midnight.
 */
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return (h * 60) + m;
}

/**
 * Converts total minutes since midnight back to "HH:mm:ss" string.
 */
function minutesToTime(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

/**
 * Generates a human-friendly unique booking reference.
 * Format: YBC-YYYYMMDD-XXXX (e.g. YBC-20260925-8492)
 */
function generateBookingReference(dateStr) {
    const cleanDate = (dateStr || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
    // Keep the short customer-facing reference format used throughout the UI.
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `YBC-${cleanDate}-${randomSuffix}`;
}

/**
 * Evaluates whether two time intervals overlap.
 * [startA, endA] overlaps with [startB, endB] if startA < endB and endA > startB.
 */
function isOverlapping(startA, endA, startB, endB) {
    return startA < endB && endA > startB;
}

/**
 * Generates available time slots for a given barber, date, duration, and existing appointments.
 *
 * @param {Object} businessHour - { is_open, open_time, close_time }
 * @param {Object} barberSchedule - { is_working, start_time, end_time }
 * @param {Array} existingBookings - Array of { start_time, end_time, status }
 * @param {Number} durationMinutes - Service duration (30, 45, 60, 75, etc.)
 * @param {String} bookingDateStr - "YYYY-MM-DD"
 * @returns {Array} List of { time: "HH:mm", available: Boolean }
 */
function generateTimeSlots(businessHour, barberSchedule, existingBookings = [], durationMinutes = 30, bookingDateStr) {
    // If shop is closed or barber is not scheduled to work on this day
    if (!businessHour || !businessHour.is_open || !barberSchedule || !barberSchedule.is_working) {
        return [];
    }

    const shopOpenMins = timeToMinutes(businessHour.open_time || '09:00:00');
    const shopCloseMins = timeToMinutes(businessHour.close_time || '20:00:00');

    const barberStartMins = timeToMinutes(barberSchedule.start_time || '09:00:00');
    const barberEndMins = timeToMinutes(barberSchedule.end_time || '18:00:00');

    // Effective working window is intersection of shop hours and barber shift
    const effectiveStart = Math.max(shopOpenMins, barberStartMins);
    const effectiveEnd = Math.min(shopCloseMins, barberEndMins);

    if (effectiveStart >= effectiveEnd) {
        return [];
    }

    // Determine current time to mark past slots if booking for today
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const currentMins = (now.getHours() * 60) + now.getMinutes();
    const isBookingForToday = bookingDateStr === todayStr;

    // Convert active existing bookings to minutes intervals
    const activeBookings = existingBookings
        .filter(b => b.status !== 'cancelled')
        .map(b => ({
            start: timeToMinutes(b.start_time),
            end: timeToMinutes(b.end_time)
        }));

    const slots = [];
    const intervalStep = 30; // Candidate slot step interval

    for (let candidateStart = effectiveStart; candidateStart < effectiveEnd; candidateStart += intervalStep) {
        const candidateEnd = candidateStart + durationMinutes;

        // If service duration would exceed barber's shift or shop closing time
        if (candidateEnd > effectiveEnd) {
            continue;
        }

        const slotTimeStr = `${String(Math.floor(candidateStart / 60)).padStart(2, '0')}:${String(candidateStart % 60).padStart(2, '0')}`;

        // Check past time if booking for today (with 15 min buffer)
        if (isBookingForToday && candidateStart <= (currentMins + 15)) {
            slots.push({ time: slotTimeStr, available: false });
            continue;
        }

        // Check if candidate slot overlaps with any active booking
        const hasConflict = activeBookings.some(booked => 
            isOverlapping(candidateStart, candidateEnd, booked.start, booked.end)
        );

        slots.push({
            time: slotTimeStr,
            available: !hasConflict
        });
    }

    return slots;
}

module.exports = {
    timeToMinutes,
    minutesToTime,
    generateBookingReference,
    isOverlapping,
    generateTimeSlots
};
