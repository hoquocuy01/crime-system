USE crime_db;

-- Chỉ chạy một lần trên database cũ được tạo trước bản nâng cấp này.
-- Database mới đã có cột và khóa ngoại trong database.sql, không cần chạy file này.
ALTER TABLE reports ADD COLUMN submitted_by_account_id INT NULL AFTER citizen_id;
ALTER TABLE reports ADD CONSTRAINT fk_reports_submitter_account
    FOREIGN KEY (submitted_by_account_id) REFERENCES users(id) ON DELETE SET NULL;

-- Gắn lại tài khoản cho các đơn không ẩn danh hiện có để giữ lịch sử người gửi.
UPDATE reports SET submitted_by_account_id = citizen_id WHERE submitted_by_account_id IS NULL AND citizen_id IS NOT NULL;
