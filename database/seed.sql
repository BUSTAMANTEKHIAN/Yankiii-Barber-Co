USE `yankiii_barber`;

-- 1. SEED DEFAULT ADMIN & DEMO CUSTOMER
-- Passwords:
-- admin@yankiiibarber.com -> Admin123!
-- customer@example.com    -> Customer123!
INSERT INTO `users` (`id`, `name`, `email`, `password`, `phone`, `role`) VALUES
(1, 'Admin Manager', 'admin@yankiiibarber.com', '$2a$10$MjHc97vSkVJu9EyJ342G2uwV7CbV6MqggfFnC8zejujBF.z8T44r2', '09171234567', 'admin'),
(2, 'Demo Customer', 'customer@example.com', '$2a$10$3Ya0.VLP6abFr30Ba.Liz.l37PgytWhL8NTHVS6vX6gmeQfdBKX.u', '09187654321', 'customer')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 2. SEED DEFAULT SERVICES
INSERT INTO `services` (`id`, `name`, `description`, `price`, `duration`, `image`, `status`) VALUES
(1, 'Classic Haircut', 'A clean and timeless haircut tailored to your preferred style. Includes consultation, rinse, and precision scissor/clipper finish.', 250.00, 30, 'assets/images/service-1.jpg', 'active'),
(2, 'Signature Fade', 'Skin taper, low, mid, or high fade with seamless transition, foil shaver close finish, and razor edge sharpness.', 350.00, 45, 'assets/images/service-2.jpg', 'active'),
(3, 'Hair & Beard', 'Complete grooming session including full haircut of choice, beard sculpting, line-up, organic beard oil, and hot towel.', 450.00, 60, 'assets/images/service-3.jpg', 'active'),
(4, 'Full Grooming VIP', 'The total executive package: Signature Fade, beard grooming, exfoliating facial cleanse, hot lather shave, scalp massage, and tonic styling.', 550.00, 75, 'assets/images/service-4.jpg', 'active')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `price` = VALUES(`price`), `duration` = VALUES(`duration`);

-- 3. SEED DEFAULT BARBERS
INSERT INTO `barbers` (`id`, `name`, `specialty`, `bio`, `image`, `status`) VALUES
(1, 'Mark Santos', 'Senior Barber', 'Over 6 years perfecting timeless shear work, executive side-parts, and texturized crops. Passionate about hair health and consultation.', 'assets/images/barber-1.jpg', 'active'),
(2, 'James Cruz', 'Fade Specialist', 'Master of low, mid, and high drop fades with surgical razor gradients. If you want a seamless blur fade, James is your chair.', 'assets/images/barber-2.jpg', 'active'),
(3, 'Alex Garcia', 'Grooming Specialist', 'Expert in straight-razor shave therapy, facial grooming, and customized beard symmetry tailored to your jawline.', 'assets/images/barber-3.jpg', 'active')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `specialty` = VALUES(`specialty`);

-- 4. SEED BUSINESS HOURS (0=Sunday ... 6=Saturday)
INSERT INTO `business_hours` (`day_of_week`, `is_open`, `open_time`, `close_time`) VALUES
(0, TRUE, '10:00:00', '18:00:00'), -- Sunday
(1, TRUE, '09:00:00', '20:00:00'), -- Monday
(2, TRUE, '09:00:00', '20:00:00'), -- Tuesday
(3, TRUE, '09:00:00', '20:00:00'), -- Wednesday
(4, TRUE, '09:00:00', '20:00:00'), -- Thursday
(5, TRUE, '09:00:00', '20:00:00'), -- Friday
(6, TRUE, '09:00:00', '20:00:00')  -- Saturday
ON DUPLICATE KEY UPDATE `open_time` = VALUES(`open_time`), `close_time` = VALUES(`close_time`), `is_open` = VALUES(`is_open`);

-- 5. SEED BARBER SCHEDULES
-- Mark: Mon-Sat 09:00-18:00, Sun OFF
-- James: Mon-Sun 09:00-18:00
-- Alex: Wed-Sun 10:00-19:00, Mon-Tue OFF
INSERT INTO `barber_schedules` (`barber_id`, `day_of_week`, `is_working`, `start_time`, `end_time`) VALUES
-- Mark (ID 1)
(1, 0, FALSE, '09:00:00', '18:00:00'),
(1, 1, TRUE,  '09:00:00', '18:00:00'),
(1, 2, TRUE,  '09:00:00', '18:00:00'),
(1, 3, TRUE,  '09:00:00', '18:00:00'),
(1, 4, TRUE,  '09:00:00', '18:00:00'),
(1, 5, TRUE,  '09:00:00', '18:00:00'),
(1, 6, TRUE,  '09:00:00', '18:00:00'),
-- James (ID 2)
(2, 0, TRUE,  '10:00:00', '18:00:00'),
(2, 1, TRUE,  '09:00:00', '18:00:00'),
(2, 2, TRUE,  '09:00:00', '18:00:00'),
(2, 3, TRUE,  '09:00:00', '18:00:00'),
(2, 4, TRUE,  '09:00:00', '18:00:00'),
(2, 5, TRUE,  '09:00:00', '18:00:00'),
(2, 6, TRUE,  '09:00:00', '18:00:00'),
-- Alex (ID 3)
(3, 0, TRUE,  '10:00:00', '18:00:00'),
(3, 1, FALSE, '09:00:00', '18:00:00'),
(3, 2, FALSE, '09:00:00', '18:00:00'),
(3, 3, TRUE,  '10:00:00', '19:00:00'),
(3, 4, TRUE,  '10:00:00', '19:00:00'),
(3, 5, TRUE,  '10:00:00', '19:00:00'),
(3, 6, TRUE,  '10:00:00', '19:00:00')
ON DUPLICATE KEY UPDATE `is_working` = VALUES(`is_working`), `start_time` = VALUES(`start_time`), `end_time` = VALUES(`end_time`);

