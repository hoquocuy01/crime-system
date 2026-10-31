USE crime_db;

-- DỮ LIỆU DEMO CHỈ DÙNG CHO ĐỒ ÁN. Mật khẩu demo cả 3 tài khoản: Demo@12345
-- Chỉ chạy trên database demo mới. Không chạy lại nếu muốn giữ dữ liệu đã phát sinh.
INSERT INTO users (username, password, full_name, email, phone, role, badge_number, unit) VALUES
('admin', '$2a$10$26ild7sitnsL.9rZxP5zQ.ZuClELQeYAe.96grslPXThUPusqJD22', 'Quản Trị Viên Demo', 'admin@example.test', '0900000001', 'admin', 'ADM-DEMO', 'Đơn vị demo'),
('police01', '$2a$10$26ild7sitnsL.9rZxP5zQ.ZuClELQeYAe.96grslPXThUPusqJD22', 'Cán Bộ Demo', 'police@example.test', '0900000002', 'police', 'CS-DEMO', 'Đơn vị demo'),
('citizen01', '$2a$10$26ild7sitnsL.9rZxP5zQ.ZuClELQeYAe.96grslPXThUPusqJD22', 'Công Dân Demo', 'citizen@example.test', '0900000003', 'citizen', NULL, NULL);

INSERT INTO crime_records (full_name, alias, identity_card, dob, pob, identifying_marks, crime_type, status, danger_level, avatar_url, created_by) VALUES
('Nguyễn Minh An (Demo)', 'An Demo', NULL, '1992-05-15', 'Hải Phòng (dữ liệu giả lập)', 'Dữ liệu nhận dạng giả lập phục vụ trình diễn', 'Vụ việc giả lập A', 'wanted', 'high', 'https://via.placeholder.com/400x500?text=DEMO', 2),
('Trần Quốc Bình (Demo)', 'Bình Demo', NULL, '1995-10-20', 'Hải Phòng (dữ liệu giả lập)', 'Dữ liệu nhận dạng giả lập phục vụ trình diễn', 'Vụ việc giả lập B', 'under_investigation', 'medium', 'https://via.placeholder.com/400x500?text=DEMO', 2);
