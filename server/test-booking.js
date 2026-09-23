'use strict';

const assert = require('node:assert/strict');
const {
    timeToMinutes,
    minutesToTime,
    generateBookingReference,
    isOverlapping,
    generateTimeSlots
} = require('./utils/bookingUtils');

assert.equal(timeToMinutes('09:30:00'), 570);
assert.equal(minutesToTime(570), '09:30:00');
assert.equal(isOverlapping(600, 660, 630, 690), true);
assert.equal(isOverlapping(600, 660, 660, 720), false, 'back-to-back slots do not overlap');

const reference = generateBookingReference('2099-01-02');
assert.match(reference, /^YBC-20990102-\d{4}$/);

const slots = generateTimeSlots(
    { is_open: 1, open_time: '09:00:00', close_time: '12:00:00' },
    { is_working: 1, start_time: '09:00:00', end_time: '12:00:00' },
    [{ start_time: '10:00:00', end_time: '10:45:00', status: 'confirmed' }],
    30,
    '2099-01-02'
);
assert.equal(slots.find(slot => slot.time === '09:30').available, true, 'a slot that ends at appointment start is available');
assert.equal(slots.find(slot => slot.time === '10:00').available, false, 'overlapping candidate is unavailable');
assert.equal(slots.find(slot => slot.time === '10:30').available, false, 'candidate starting inside an appointment is unavailable');
assert.equal(slots.find(slot => slot.time === '11:00').available, true, 'free candidate remains available');

assert.deepEqual(generateTimeSlots(
    { is_open: 0, open_time: '09:00:00', close_time: '12:00:00' },
    { is_working: 1, start_time: '09:00:00', end_time: '12:00:00' },
    [], 30, '2099-01-02'
), [], 'closed shop has no available slots');

console.log('Booking utility checks passed.');
