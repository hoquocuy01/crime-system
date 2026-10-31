# Hệ thống Quản lý Hồ sơ Tội phạm — Bản nâng cấp ưu tiên bảo mật

## 👥 Thành Viên Thực Hiện
- **Hồ Quốc Uy**
- **Nguyễn Việt Tiến**
- **Vũ Bình Minh**
## 1. Công nghệ
- Node.js + Express
- MySQL 8+
- HTML, CSS, JavaScript thuần
- JWT + bcryptjs

## 2. Trước khi cập nhật
1. Sao lưu thư mục dự án hiện tại.
2. Sao lưu database trong MySQL Workbench: **Server → Data Export** → chọn `crime_db` → Export to Self-Contained File.
3. Không chạy lại script seed trên database đang có dữ liệu.
4. Dùng dữ liệu giả lập; không đưa dữ liệu hồ sơ cá nhân/tội phạm thật vào môi trường demo.

## 3. Cài đặt lần đầu trên Windows
1. Cài Node.js LTS và MySQL Server.
2. Mở thư mục `crime-system` trong VS Code.
3. Mở Terminal tại thư mục này, chạy `npm install`.
4. Sao chép `.env.example` thành `.env`.
5. Sửa `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` theo MySQL trên máy bạn. Với demo cục bộ có thể dùng tài khoản MySQL hiện có; không để mật khẩu rỗng nếu máy bạn đã đặt mật khẩu. Khi triển khai nghiêm túc, tạo user MySQL riêng cho ứng dụng thay vì dùng `root`.
6. Tạo JWT secret ngẫu nhiên bằng lệnh:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
   Dán kết quả vào `JWT_SECRET` trong `.env`. Không dùng chuỗi ví dụ.
7. Mở MySQL Workbench và chạy `database.sql` để tạo database/bảng.
8. Chỉ trên database demo mới, chạy `seed.sql` để tạo dữ liệu mẫu.
9. Chạy `migrations/001_audit_logs.sql` để bật nhật ký kiểm toán.
10. Nếu nâng cấp database cũ đã tạo trước khi có cột `submitted_by_account_id`, hãy sao lưu trước rồi chạy `migrations/002_anonymous_report_history.sql` đúng một lần. Database mới tạo từ `database.sql` không cần chạy migration 002.
11. Chạy `npm run check`, sau đó `npm start`.
12. Mở `http://localhost:3000` và kiểm tra `http://localhost:3000/api/health`.

## 4. Tài khoản demo
Mật khẩu demo của ba tài khoản seed là `Demo@12345`:
- `admin`
- `police01`
- `citizen01`

Chỉ dùng các tài khoản này trong môi trường demo cục bộ. Đổi mật khẩu ngay nếu triển khai ở môi trường có người dùng khác.

## 5. Các điểm nâng cấp chính
- JWT secret chuyển sang biến môi trường; token chỉ chấp nhận thuật toán HS256.
- Middleware xác thực kiểm tra trạng thái và vai trò hiện tại từ database; tài khoản bị khóa không tiếp tục dùng token cũ.
- CORS không mở cho mọi origin; giới hạn kích thước request và thêm một số security headers.
- Giới hạn thử đăng nhập ở mức cơ bản theo IP.
- Validate dữ liệu đăng ký, đổi mật khẩu, hồ sơ, tố giác và trạng thái.
- API công khai chỉ trả hồ sơ `wanted` và trường dữ liệu được chọn; có endpoint chi tiết công khai.
- Lỗi database không trả chi tiết nội bộ cho trình duyệt.
- Thêm nhật ký kiểm toán cho các hành động quan trọng.
- Tách schema khỏi seed; `database.sql` không còn lệnh xóa dữ liệu hiện có.
- Thêm escape HTML cho các trường dữ liệu động ở các màn hình được chỉnh sửa.
- Tố giác ẩn danh không trả thông tin người gửi cho danh sách cán bộ; tài khoản gửi vẫn có thể theo dõi đơn của mình trong trang cá nhân. Đây là ẩn danh ở giao diện nghiệp vụ, không phải ẩn danh tuyệt đối với quản trị viên database.

## 6. Kiểm thử thủ công trước khi demo
Xem `TEST_PLAN_VI.md`. Không tuyên bố hệ thống đã an toàn tuyệt đối; đây là bản đồ án, chưa qua kiểm thử xâm nhập hoặc đánh giá bảo mật độc lập.

## 7. Khuyến nghị trước khi đưa lên mạng
- Không dùng tài khoản MySQL `root` cho ứng dụng nếu có thể; tạo user riêng chỉ có quyền trên `crime_db`.
- Bật HTTPS, cấu hình CORS origin cụ thể, quản lý secret an toàn và thiết lập backup định kỳ.
- Thêm CSRF protection nếu chuyển sang cookie xác thực; cân nhắc thay token trong `localStorage` bằng mô hình phù hợp để giảm rủi ro khi có XSS.
- Kiểm tra tệp tải lên bằng allowlist MIME, dung lượng và lưu ngoài thư mục public nếu bổ sung upload.
- Yêu cầu pháp lý và quy trình công bố dữ liệu phải được xác minh trước mọi triển khai thực tế.
