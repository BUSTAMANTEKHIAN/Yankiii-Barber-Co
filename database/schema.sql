-- ==========================================================
-- YANKIII BARBER CO. — DATABASE SCHEMA
-- Target Database: yankiii_barber
-- Compatible with MySQL 5.7, 8.0, 9.x
-- ==========================================================

CREATE DATABASE IF NOT EXISTS `yankiii_barber`
DEFAULT CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `yankiii_barber`;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL UNIQUE,
    `password` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(50) DEFAULT NULL,
    `role` ENUM('customer', 'admin') DEFAULT 'customer',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. BARBERS TABLE
CREATE TABLE IF NOT EXISTS `barbers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `specialty` VARCHAR(100) NOT NULL,
    `bio` TEXT DEFAULT NULL,
    `image` VARCHAR(255) DEFAULT NULL,
    `status` ENUM('active', 'inactive') DEFAULT 'active',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. SERVICES TABLE
CREATE TABLE IF NOT EXISTS `services` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT DEFAULT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `duration` INT NOT NULL COMMENT 'Duration in minutes',
    `image` VARCHAR(255) DEFAULT NULL,
    `status` ENUM('active', 'inactive') DEFAULT 'active',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. BARBER SCHEDULES TABLE
CREATE TABLE IF NOT EXISTS `barber_schedules` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `barber_id` INT NOT NULL,
    `day_of_week` TINYINT NOT NULL COMMENT '0=Sunday, 1=Monday, ..., 6=Saturday',
    `is_working` BOOLEAN DEFAULT TRUE,
    `start_time` TIME DEFAULT '09:00:00',
    `end_time` TIME DEFAULT '18:00:00',
    CONSTRAINT `fk_schedule_barber` FOREIGN KEY (`barber_id`) 
        REFERENCES `barbers` (`id`) ON DELETE CASCADE,
    UNIQUE KEY `unique_barber_day` (`barber_id`, `day_of_week`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. BUSINESS HOURS TABLE
CREATE TABLE IF NOT EXISTS `business_hours` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `day_of_week` TINYINT NOT NULL UNIQUE COMMENT '0=Sunday, 1=Monday, ..., 6=Saturday',
    `is_open` BOOLEAN DEFAULT TRUE,
    `open_time` TIME DEFAULT '09:00:00',
    `close_time` TIME DEFAULT '20:00:00'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS `bookings` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `booking_reference` VARCHAR(50) NOT NULL UNIQUE,
    `user_id` INT DEFAULT NULL,
    `customer_name` VARCHAR(100) NOT NULL,
    `customer_email` VARCHAR(150) NOT NULL,
    `customer_phone` VARCHAR(50) NOT NULL,
    `barber_id` INT NOT NULL,
    `service_id` INT NOT NULL,
    `booking_date` DATE NOT NULL,
    `start_time` TIME NOT NULL,
    `end_time` TIME NOT NULL,
    `total_price` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('pending', 'confirmed', 'completed', 'cancelled') DEFAULT 'pending',
    `notes` TEXT DEFAULT NULL,
    `payment_method` VARCHAR(50) DEFAULT 'pay_at_shop',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_booking_user` FOREIGN KEY (`user_id`) 
        REFERENCES `users` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_booking_barber` FOREIGN KEY (`barber_id`) 
        REFERENCES `barbers` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_booking_service` FOREIGN KEY (`service_id`) 
        REFERENCES `services` (`id`) ON DELETE RESTRICT,
    INDEX `idx_barber_date` (`barber_id`, `booking_date`),
    INDEX `idx_user_bookings` (`user_id`),
    INDEX `idx_booking_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

