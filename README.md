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

## 5. Giao diện web
<img width="602" height="289" alt="image" src="https://github.com/user-attachments/assets/29b22979-f814-4dac-aa38-6fa0896f01b8" />

<img width="601" height="295" alt="image" src="https://github.com/user-attachments/assets/eff92dd2-b89b-4958-a4ee-8969199fc7b7" />

<img width="602" height="290" alt="image" src="https://github.com/user-attachments/assets/a52c9a92-3890-4287-addd-9eb43b7b5546" />

<img width="601" height="310" alt="image" src="https://github.com/user-attachments/assets/a9a84eec-85a5-4f85-a9af-bcfea422da75" />

<img width="601" height="291" alt="image" src="https://github.com/user-attachments/assets/6991b0df-71a5-44e8-b58a-cc8929f7d000" />

<img width="602" height="290" alt="image" src="https://github.com/user-attachments/assets/a4763d3b-2013-45a0-85c4-e937872d47e1" />

<img width="601" height="291" alt="image" src="https://github.com/user-attachments/assets/5508912e-2aa3-42e7-8e50-da2d703def90" />

<img width="602" height="290" alt="image" src="https://github.com/user-attachments/assets/88d52ab5-ad26-480b-9aa7-46257b2bc4e4" />

<img width="602" height="293" alt="image" src="https://github.com/user-attachments/assets/f3452e97-85f9-46b6-baa3-7d96b497e7fa" />

<img width="602" height="290" alt="image" src="https://github.com/user-attachments/assets/f2a92f98-c0f5-4f78-896d-1334d7800b93" />

<img width="601" height="286" alt="image" src="https://github.com/user-attachments/assets/52a12a5e-10e0-448b-b0e7-5f55cac4a58e" />

