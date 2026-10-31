CREATE DATABASE IF NOT EXISTS crime_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE crime_db;

-- 1. Bảng Tài khoản
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    role ENUM('citizen', 'police', 'admin') NOT NULL DEFAULT 'citizen',
    badge_number VARCHAR(50) DEFAULT NULL, -- Số hiệu CAND nếu là cảnh sát
    unit VARCHAR(100) DEFAULT NULL,         -- Đơn vị công tác
    status ENUM('active', 'blocked') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng Hồ sơ Tội phạm
CREATE TABLE IF NOT EXISTS crime_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    alias VARCHAR(100),
    identity_card VARCHAR(20),
    dob DATE,
    pob VARCHAR(200),
    identifying_marks TEXT,
    crime_type VARCHAR(100) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'under_investigation',
    danger_level ENUM('low', 'medium', 'high', 'extremely_dangerous') DEFAULT 'medium',
    avatar_url TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 3. Bảng Đơn tố giác Tội phạm
CREATE TABLE IF NOT EXISTS reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_code VARCHAR(20) NOT NULL UNIQUE,
    citizen_id INT DEFAULT NULL,
    -- Tài khoản gửi dùng riêng cho lịch sử của chính người gửi; không trả trường này cho cán bộ.
    submitted_by_account_id INT DEFAULT NULL,
    is_anonymous TINYINT(1) DEFAULT 0,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(255) NOT NULL,
    evidence_url TEXT,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    police_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (citizen_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (submitted_by_account_id) REFERENCES users(id) ON DELETE SET NULL
);

-- An toàn: file này chỉ tạo database/bảng nếu chưa có, không xóa dữ liệu hiện hữu.
