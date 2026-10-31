require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const multer = require('multer');

const db = require('./config/db');
const { verifyToken, checkRole, JWT_SECRET } = require('./middleware/auth');

const app = express();

// Lưu ảnh đại diện trong public/uploads để website hiển thị được ảnh đã tải lên.
const uploadDir = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const uploadStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const extension = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype];
        cb(null, require('crypto').randomBytes(16).toString('hex') + extension);
    }
});
const uploadAvatar = multer({
    storage: uploadStorage,
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
            return cb(new Error('Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.'));
        }
        cb(null, true);
    }
});

// ==========================================
// MIDDLEWARE CƠ BẢN
// ==========================================
const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({
    origin(origin, callback) {
        // Không có Origin thường là truy cập cùng máy/chương trình CLI; cho phép.
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Nguồn truy cập không được phép bởi CORS.'));
    },
    credentials: false
}));
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const isPositiveId = (value) => /^\d+$/.test(String(value)) && Number(value) > 0;
const isNonEmptyString = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
const validEmail = (value) => !value || (typeof value === 'string' && value.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
const validUrlOrEmpty = (value) => !value || (typeof value === 'string' && value.length <= 2048 && (/^https?:\/\//i.test(value) || /^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/i.test(value)));
const safeError = (res, err, label = 'API') => {
    if (err && err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Dữ liệu đã tồn tại. Vui lòng kiểm tra mã hoặc tên đăng nhập.' });
    console.error(`[${label}]`, err);
    return res.status(500).json({ message: 'Đã xảy ra lỗi máy chủ. Vui lòng thử lại.' });
};

// Giới hạn thử đăng nhập theo IP để giảm brute-force ở bản đồ án.
const loginAttempts = new Map();
const loginRateLimit = (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const current = loginAttempts.get(key);
    if (loginAttempts.size > 5000) {
        for (const [ip, record] of loginAttempts) if (now - record.start > 15 * 60 * 1000) loginAttempts.delete(ip);
    }
    if (!current || now - current.start > 15 * 60 * 1000) {
        loginAttempts.set(key, { start: now, count: 1 });
        return next();
    }
    if (current.count >= 10) return res.status(429).json({ message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.' });
    current.count += 1;
    return next();
};

async function writeAuditLog(req, action, entityType, entityId, details = {}) {
    try {
        await db.query(
            'INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, ip_address, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.user?.id || null, req.user?.role || 'system', action, entityType, entityId == null ? null : String(entityId), (req.ip || '').slice(0, 45), JSON.stringify(details)]
        );
    } catch (err) {
        // Chức năng chính vẫn hoạt động nếu người cài chưa chạy migration; cần chạy migration để bật audit log.
        console.error('[Audit log] Không ghi được nhật ký. Hãy chạy migrations/001_audit_logs.sql:', err.message);
    }
}


// ==========================================
// DỊCH VỤ FILE TĨNH & ĐỊNH TUYẾN TRANG WEB
// ==========================================

// Endpoint kiểm tra tình trạng ứng dụng và kết nối database.
app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
    } catch (err) {
        console.error('[Health check]', err);
        res.status(503).json({ status: 'degraded', database: 'unavailable' });
    }
});

// 1. Định tuyến cho trang chủ gốc (http://localhost:3000)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// 2. Định tuyến cho các đường dẫn HTML
app.get('/home', (req, res) => res.sendFile(path.join(__dirname, 'public', 'home.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/citizen', (req, res) => res.sendFile(path.join(__dirname, 'public', 'citizen.html')));
app.get('/tra-cuu', (req, res) => res.sendFile(path.join(__dirname, 'public', 'wanted.html')));
app.get('/police', (req, res) => res.sendFile(path.join(__dirname, 'public', 'police.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// 3. Phục vụ các file tĩnh trong thư mục public (CSS, JS, Hình ảnh,...)
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ==========================================
// 1. TÀI KHOẢN & XÁC THỰC (AUTH & PROFILE)
// ==========================================

// Đăng ký tài khoản (Dành riêng cho Người Dân)
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, full_name, email, phone } = req.body;
        if (!isNonEmptyString(username, 50) || !/^[a-zA-Z0-9_.-]+$/.test(username.trim())) {
            return res.status(400).json({ message: 'Tên đăng nhập bắt buộc, tối đa 50 ký tự và chỉ gồm chữ, số, dấu . _ -.' });
        }
        if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
            return res.status(400).json({ message: 'Mật khẩu phải dài từ 8 đến 72 ký tự.' });
        }
        if (!isNonEmptyString(full_name, 100) || !validEmail(email) || (phone && (typeof phone !== 'string' || phone.length > 20))) {
            return res.status(400).json({ message: 'Họ tên, email hoặc số điện thoại không hợp lệ.' });
        }
        
        const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) return res.status(400).json({ message: 'Tên đăng nhập / CCCD đã tồn tại!' });

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(
            'INSERT INTO users (username, password, full_name, email, phone, role) VALUES (?, ?, ?, ?, ?, "citizen")',
            [username, hashedPassword, full_name, email, phone]
        );

        res.json({ success: true, message: 'Đăng ký tài khoản Người Dân thành công!' });
    } catch (err) {
        return safeError(res, err);
    }
});

// Đăng nhập chung cho cả 3 luồng
app.post('/api/auth/login', loginRateLimit, async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!isNonEmptyString(username, 50) || typeof password !== 'string' || password.length > 72) {
            return res.status(400).json({ message: 'Vui lòng nhập tên đăng nhập và mật khẩu hợp lệ.' });
        }
        const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        
        if (users.length === 0) return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
        const user = users[0];

        if (user.status === 'blocked') return res.status(403).json({ message: 'Tài khoản này đã bị khóa bởi Admin!' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
            JWT_SECRET,
            { expiresIn: '8h', algorithm: 'HS256' }
        );
        loginAttempts.delete(req.ip || req.socket.remoteAddress || 'unknown');

        res.json({
            success: true,
            token,
            role: user.role,
            user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role }
        });
    } catch (err) {
        return safeError(res, err);
    }
});

// Lấy thông tin hồ sơ cá nhân
app.get('/api/user/profile', verifyToken, async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, username, full_name, email, phone, role, badge_number, unit FROM users WHERE id = ?', 
            [req.user.id]
        );
        res.json(users[0]);
    } catch (err) {
        return safeError(res, err);
    }
});

// Cập nhật thông tin cá nhân
app.put('/api/user/profile', verifyToken, async (req, res) => {
    try {
        const { full_name, email, phone, unit } = req.body;
        if (!isNonEmptyString(full_name, 100) || !validEmail(email) || (phone && (typeof phone !== 'string' || phone.length > 20)) || (unit && (typeof unit !== 'string' || unit.length > 100))) {
            return res.status(400).json({ message: 'Thông tin hồ sơ không hợp lệ.' });
        }
        await db.query(
            'UPDATE users SET full_name = ?, email = ?, phone = ?, unit = ? WHERE id = ?',
            [full_name, email, phone, unit || null, req.user.id]
        );
        res.json({ success: true, message: 'Cập nhật thông tin thành công!' });
    } catch (err) {
        return safeError(res, err);
    }
});

// Đổi mật khẩu
app.put('/api/user/change-password', verifyToken, async (req, res) => {
    try {
        const { old_password, new_password } = req.body;
        if (typeof old_password !== 'string' || typeof new_password !== 'string' || new_password.length < 8 || new_password.length > 72) {
            return res.status(400).json({ message: 'Mật khẩu mới phải dài từ 8 đến 72 ký tự.' });
        }
        const [users] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
        
        if (!users.length) return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ.' });
        const validPassword = await bcrypt.compare(old_password, users[0].password);
        if (!validPassword) return res.status(400).json({ message: 'Mật khẩu cũ không chính xác!' });

        const newHash = await bcrypt.hash(new_password, 10);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [newHash, req.user.id]);
        
        res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
    } catch (err) {
        return safeError(res, err);
    }
});

// ==========================================
// 2. LUỒNG NGƯỜI DÂN & TỐ GIÁC TỘI PHẠM
// ==========================================

// Danh sách hồ sơ tội phạm cho cổng thông tin công dân và trang tra cứu.
// Chỉ trả các trường phục vụ tra cứu; không công khai số CCCD/CMND hoặc dữ liệu tài khoản.
app.get('/api/public/crimes', async (req, res) => {
    try {
        const [crimes] = await db.query(
            `SELECT id, full_name, alias, dob, pob, identifying_marks, crime_type, danger_level, avatar_url, status
             FROM crime_records ORDER BY created_at DESC, id DESC LIMIT 1000`
        );
        res.json(crimes);
    } catch (err) {
        return safeError(res, err, 'public crime list');
    }
});

// Tương thích với các trang cũ đang gọi API wanted: nay trả toàn bộ hồ sơ.
app.get('/api/public/wanted', async (req, res) => {
    try {
        const [crimes] = await db.query(
            `SELECT id, full_name, alias, dob, pob, identifying_marks, crime_type, danger_level, avatar_url, status
             FROM crime_records ORDER BY created_at DESC, id DESC LIMIT 1000`
        );
        res.json(crimes);
    } catch (err) {
        return safeError(res, err, 'public crime list legacy');
    }
});

app.get('/api/public/crimes/:id', async (req, res) => {
    if (!isPositiveId(req.params.id)) return res.status(400).json({ message: 'Mã hồ sơ không hợp lệ.' });
    try {
        const [rows] = await db.query(
            `SELECT id, full_name, alias, dob, pob, identifying_marks, crime_type, danger_level, avatar_url, status
             FROM crime_records WHERE id = ? LIMIT 1`,
            [Number(req.params.id)]
        );
        if (!rows.length) return res.status(404).json({ message: 'Không tìm thấy hồ sơ.' });
        res.json(rows[0]);
    } catch (err) { return safeError(res, err, 'public crime detail'); }
});

// Tương thích đường dẫn chi tiết cũ.
app.get('/api/public/wanted/:id', async (req, res) => {
    if (!isPositiveId(req.params.id)) return res.status(400).json({ message: 'Mã hồ sơ không hợp lệ.' });
    try {
        const [rows] = await db.query(
            `SELECT id, full_name, alias, dob, pob, identifying_marks, crime_type, danger_level, avatar_url, status
             FROM crime_records WHERE id = ? LIMIT 1`,
            [Number(req.params.id)]
        );
        if (!rows.length) return res.status(404).json({ message: 'Không tìm thấy hồ sơ.' });
        res.json(rows[0]);
    } catch (err) { return safeError(res, err, 'public crime detail legacy'); }
});

// Người Dân: Gửi đơn tố giác
app.post('/api/reports', verifyToken, checkRole('citizen'), async (req, res) => {
    try {
        const { title, description, location, evidence_url, is_anonymous } = req.body;
        if (!isNonEmptyString(title, 200) || !isNonEmptyString(description, 10000) || !isNonEmptyString(location, 255) || !validUrlOrEmpty(evidence_url)) {
            return res.status(400).json({ message: 'Tiêu đề, nội dung, địa điểm hoặc đường dẫn bằng chứng không hợp lệ.' });
        }
        const crypto = require('crypto');
        const report_code = 'REP-' + crypto.randomBytes(5).toString('hex').toUpperCase();
        const anonymous = is_anonymous === true || is_anonymous === 1 || is_anonymous === 'true' || is_anonymous === '1';
        const citizen_id = anonymous ? null : req.user.id;

        const [insertResult] = await db.query(
            'INSERT INTO reports (report_code, citizen_id, submitted_by_account_id, is_anonymous, title, description, location, evidence_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [report_code, citizen_id, req.user.id, anonymous ? 1 : 0, title.trim(), description.trim(), location.trim(), evidence_url || null]
        );
        await writeAuditLog(req, 'create', 'report', insertResult.insertId, { report_code, is_anonymous: anonymous });
        res.json({ success: true, message: 'Đã gửi đơn tố giác thành công!', report_code });
    } catch (err) {
        return safeError(res, err);
    }
});

// Người Dân: Lịch sử tố giác cá nhân
app.get('/api/reports/my-reports', verifyToken, checkRole('citizen'), async (req, res) => {
    try {
        const [reports] = await db.query('SELECT id, report_code, is_anonymous, title, description, location, status, police_note, created_at FROM reports WHERE citizen_id = ? OR submitted_by_account_id = ? ORDER BY created_at DESC', [req.user.id, req.user.id]);
        res.json(reports);
    } catch (err) {
        return safeError(res, err);
    }
});

// ==========================================
// 3. LUỒNG CẢNH SÁT (POLICE)
// ==========================================

// Cảnh sát: Xem danh sách đơn tố giác
app.get('/api/police/reports', verifyToken, checkRole('police', 'admin'), async (req, res) => {
    try {
        const [reports] = await db.query(
            `SELECT r.id, r.report_code, r.citizen_id, r.is_anonymous, r.title, r.description,
                    r.location, r.evidence_url, r.status, r.police_note, r.created_at,
                    u.full_name AS citizen_name, u.phone AS citizen_phone
             FROM reports r LEFT JOIN users u ON r.citizen_id = u.id ORDER BY r.created_at DESC`
        );
        res.json(reports);
    } catch (err) {
        return safeError(res, err);
    }
});

// Cảnh sát: Phê duyệt / Từ chối đơn tố giác
app.put('/api/police/reports/:id', verifyToken, checkRole('police', 'admin'), async (req, res) => {
    try {
        const { status, police_note } = req.body;
        const allowedStatuses = ['pending', 'approved', 'rejected'];
        if (!isPositiveId(req.params.id) || !allowedStatuses.includes(status) || (police_note != null && (typeof police_note !== 'string' || police_note.length > 5000))) {
            return res.status(400).json({ message: 'Mã đơn, trạng thái hoặc ghi chú không hợp lệ.' });
        }
        const [result] = await db.query('UPDATE reports SET status = ?, police_note = ? WHERE id = ?', [status, police_note || null, Number(req.params.id)]);
        if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy đơn tố giác.' });
        await writeAuditLog(req, 'update_status', 'report', req.params.id, { status });
        res.json({ success: true, message: 'Cập nhật trạng thái đơn tố giác thành công!' });
    } catch (err) {
        return safeError(res, err);
    }
});

// Cảnh sát: Quản lý CRUD Hồ sơ Tội phạm
app.get('/api/crimes', verifyToken, checkRole('police', 'admin'), async (req, res) => {
    try {
        const [crimes] = await db.query('SELECT c.*, u.full_name AS creator_name FROM crime_records c LEFT JOIN users u ON c.created_by = u.id ORDER BY c.id DESC');
        res.json(crimes);
    } catch (err) {
        return safeError(res, err);
    }
});

// Tải ảnh đại diện từ máy tính (chỉ cảnh sát/quản trị viên).
app.post('/api/upload/avatar', verifyToken, checkRole('police', 'admin'), (req, res) => {
    uploadAvatar.single('avatar')(req, res, (err) => {
        if (err) {
            const message = err.code === 'LIMIT_FILE_SIZE'
                ? 'Ảnh không được vượt quá 5 MB.'
                : (err.message || 'Không tải được ảnh lên.');
            return res.status(400).json({ message });
        }
        if (!req.file) return res.status(400).json({ message: 'Bạn chưa chọn ảnh.' });
        return res.json({ success: true, avatar_url: '/uploads/' + req.file.filename });
    });
});

app.post('/api/crimes', verifyToken, checkRole('police', 'admin'), async (req, res) => {
    try {
        const { full_name, alias, identity_card, dob, pob, identifying_marks, crime_type, status, danger_level, avatar_url } = req.body;
        if (!isNonEmptyString(full_name, 100) || !isNonEmptyString(crime_type, 100)) return res.status(400).json({ message: 'Họ tên và loại vụ việc là bắt buộc.' });
        if (status && !['wanted', 'under_investigation', 'detained', 'arrested', 'prosecuted', 'awaiting_trial', 'convicted', 'serving_sentence', 'released', 'acquitted', 'case_suspended', 'case_closed', 'deceased'].includes(status)) return res.status(400).json({ message: 'Trạng thái hồ sơ không hợp lệ.' });
        if (danger_level && !['low', 'medium', 'high', 'extremely_dangerous'].includes(danger_level)) return res.status(400).json({ message: 'Mức độ nguy hiểm không hợp lệ.' });
        if (avatar_url && !validUrlOrEmpty(avatar_url)) return res.status(400).json({ message: 'Đường dẫn ảnh không hợp lệ.' });
        const [insertResult] = await db.query(
            `INSERT INTO crime_records (full_name, alias, identity_card, dob, pob, identifying_marks, crime_type, status, danger_level, avatar_url, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [full_name, alias, identity_card, dob, pob, identifying_marks, crime_type, status, danger_level, avatar_url, req.user.id]
        );
        await writeAuditLog(req, 'create', 'crime_record', insertResult.insertId, { status: status || 'wanted' });
        res.json({ success: true, message: 'Tạo mới hồ sơ tội phạm thành công!' });
    } catch (err) {
        return safeError(res, err);
    }
});

app.put('/api/crimes/:id', verifyToken, checkRole('police', 'admin'), async (req, res) => {
    try {
        const { full_name, alias, identity_card, dob, pob, identifying_marks, crime_type, status, danger_level, avatar_url } = req.body;
        if (!isPositiveId(req.params.id)) return res.status(400).json({ message: 'Mã hồ sơ không hợp lệ.' });
        if (!isNonEmptyString(full_name, 100) || !isNonEmptyString(crime_type, 100)) return res.status(400).json({ message: 'Họ tên và loại vụ việc là bắt buộc.' });
        if (status && !['wanted', 'under_investigation', 'detained', 'arrested', 'prosecuted', 'awaiting_trial', 'convicted', 'serving_sentence', 'released', 'acquitted', 'case_suspended', 'case_closed', 'deceased'].includes(status)) return res.status(400).json({ message: 'Trạng thái hồ sơ không hợp lệ.' });
        if (danger_level && !['low', 'medium', 'high', 'extremely_dangerous'].includes(danger_level)) return res.status(400).json({ message: 'Mức độ nguy hiểm không hợp lệ.' });
        if (avatar_url && !validUrlOrEmpty(avatar_url)) return res.status(400).json({ message: 'Đường dẫn ảnh không hợp lệ.' });
        await db.query(
            `UPDATE crime_records SET full_name=?, alias=?, identity_card=?, dob=?, pob=?, identifying_marks=?, crime_type=?, status=?, danger_level=?, avatar_url=?
             WHERE id=?`,
            [full_name, alias, identity_card, dob, pob, identifying_marks, crime_type, status, danger_level, avatar_url, req.params.id]
        );
        await writeAuditLog(req, 'update', 'crime_record', req.params.id, { status });
        res.json({ success: true, message: 'Cập nhật hồ sơ tội phạm thành công!' });
    } catch (err) {
        return safeError(res, err);
    }
});

app.delete('/api/crimes/:id', verifyToken, checkRole('police', 'admin'), async (req, res) => {
    try {
        if (!isPositiveId(req.params.id)) return res.status(400).json({ message: 'Mã hồ sơ không hợp lệ.' });
        const [result] = await db.query('DELETE FROM crime_records WHERE id = ?', [Number(req.params.id)]);
        if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy hồ sơ.' });
        await writeAuditLog(req, 'delete', 'crime_record', req.params.id);
        res.json({ success: true, message: 'Đã xóa hồ sơ khỏi hệ thống!' });
    } catch (err) {
        return safeError(res, err);
    }
});

// ==========================================
// 4. LUỒNG QUẢN TRỊ VIÊN (ADMIN)
// ==========================================

// Admin: Thống kê Dashboard
app.get('/api/admin/stats', verifyToken, checkRole('admin'), async (req, res) => {
    try {
        const [[{ total_crimes }]] = await db.query('SELECT COUNT(*) AS total_crimes FROM crime_records');
        const [[{ total_wanted }]] = await db.query('SELECT COUNT(*) AS total_wanted FROM crime_records WHERE status = "wanted"');
        const [[{ total_reports }]] = await db.query('SELECT COUNT(*) AS total_reports FROM reports');
        const [[{ total_users }]] = await db.query('SELECT COUNT(*) AS total_users FROM users');

        res.json({ total_crimes, total_wanted, total_reports, total_users });
    } catch (err) {
        return safeError(res, err);
    }
});

// Admin: xem nhật ký kiểm toán, giới hạn số dòng để tránh tải quá nhiều dữ liệu.
app.get('/api/admin/audit-logs', verifyToken, checkRole('admin'), async (req, res) => {
    try {
        const requestedLimit = Number.parseInt(req.query.limit, 10);
        const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
        const [rows] = await db.query(
            `SELECT id, actor_id, actor_role, action, entity_type, entity_id, ip_address, details_json, created_at
             FROM audit_logs ORDER BY id DESC LIMIT ?`, [limit]
        );
        res.json(rows);
    } catch (err) { return safeError(res, err, 'admin audit logs'); }
});

// Admin: Danh sách tất cả tài khoản
app.get('/api/admin/users', verifyToken, checkRole('admin'), async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, username, full_name, email, phone, role, badge_number, unit, status, created_at FROM users ORDER BY id DESC');
        res.json(users);
    } catch (err) {
        return safeError(res, err);
    }
});

// Admin: Cấp tài khoản mới Cảnh sát
app.post('/api/admin/users/create-police', verifyToken, checkRole('admin'), async (req, res) => {
    try {
        const { username, password, full_name, email, phone, badge_number, unit } = req.body;
        if (!isNonEmptyString(username, 50) || !/^[a-zA-Z0-9_.-]+$/.test(username.trim()) || typeof password !== 'string' || password.length < 8 || password.length > 72 || !isNonEmptyString(full_name, 100) || !validEmail(email)) {
            return res.status(400).json({ message: 'Thông tin tài khoản cảnh sát không hợp lệ; mật khẩu phải từ 8 đến 72 ký tự.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            'INSERT INTO users (username, password, full_name, email, phone, role, badge_number, unit) VALUES (?, ?, ?, ?, ?, "police", ?, ?)',
            [username, hashedPassword, full_name, email, phone, badge_number, unit]
        );

        res.json({ success: true, message: 'Cấp tài khoản Cảnh sát mới thành công!' });
    } catch (err) {
        return safeError(res, err);
    }
});

// Admin: Khóa / Mở khóa tài khoản
app.put('/api/admin/users/:id/toggle-status', verifyToken, checkRole('admin'), async (req, res) => {
    try {
        const { status } = req.body;
        if (!isPositiveId(req.params.id) || !['active', 'blocked'].includes(status)) return res.status(400).json({ message: 'Mã tài khoản hoặc trạng thái không hợp lệ.' });
        if (Number(req.params.id) === Number(req.user.id)) return res.status(400).json({ message: 'Không thể tự khóa tài khoản đang đăng nhập.' });
        const [result] = await db.query("UPDATE users SET status = ? WHERE id = ? AND role <> 'admin'", [status, Number(req.params.id)]);
        if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy tài khoản hoặc không được phép thay đổi.' });
        await writeAuditLog(req, 'toggle_status', 'user', req.params.id, { status });
        res.json({ success: true, message: 'Cập nhật trạng thái tài khoản thành công!' });
    } catch (err) {
        return safeError(res, err);
    }
});


// Xóa lịch sử tố giác
app.delete('/api/reports/:id', verifyToken, checkRole('citizen'), async (req, res) => {
    const reportId = req.params.id;
    if (!isPositiveId(reportId)) return res.status(400).json({ success: false, message: 'Mã đơn không hợp lệ.' });
    // Người dân chỉ được xóa đơn của chính mình khi đơn còn chờ xử lý.
    const userId = req.user.id || req.user.userId;

    try {
        // Dùng citizen_id theo đúng schema của MySQL
        const [result] = await db.query(
            "DELETE FROM reports WHERE id = ? AND (citizen_id = ? OR submitted_by_account_id = ?) AND status = 'pending'",
            [Number(reportId), userId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Không tìm thấy đơn hoặc bạn không có quyền xóa đơn này!' 
            });
        }

        return res.json({ 
            success: true, 
            message: 'Xóa đơn tố giác thành công!' 
        });
    } catch (err) {
        console.error('❌ Lỗi MySQL khi xóa đơn tố giác:', err);
        return res.status(500).json({ 
            success: false, 
            message: 'Lỗi máy chủ khi xóa đơn tố giác!', 
            error: err.message 
        });
    }
});

// Xử lý các đường dẫn API không tồn tại (404 API Handler)
app.use('/api/*', (req, res) => {
    res.status(404).json({ message: 'API Endpoint không tồn tại!' });
});

// Trả lỗi API theo JSON, không lộ stack trace hoặc thông tin database.
app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err && err.type === 'entity.too.large') return res.status(413).json({ message: 'Dữ liệu gửi lên vượt quá giới hạn 1 MB.' });
    if (err && String(err.message || '').includes('CORS')) return res.status(403).json({ message: 'Nguồn truy cập không được phép.' });
    console.error('[Express error]', err);
    return res.status(400).json({ message: 'Yêu cầu không hợp lệ.' });
});

// KÍCH HOẠT SERVER
const PORT = Number(process.env.PORT || 3000);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('PORT không hợp lệ trong file .env.');
app.listen(PORT, () => console.log(`Police Web Server đang chạy tại: http://localhost:${PORT}`));