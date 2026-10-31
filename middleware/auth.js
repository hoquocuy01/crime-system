require('dotenv').config();
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32 || JWT_SECRET === 'CHANGE_ME' || JWT_SECRET.startsWith('THAY_BANG')) {
    throw new Error('JWT_SECRET chưa được cấu hình an toàn. Hãy tạo giá trị ngẫu nhiên dài ít nhất 32 ký tự trong file .env.');
}

// Kiểm tra token và trạng thái tài khoản hiện tại trong database để token cũ
// không tiếp tục hoạt động sau khi tài khoản bị khóa hoặc đổi vai trò.
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const parts = authHeader.split(' ');
    const token = parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null;
    if (!token) return res.status(401).json({ message: 'Vui lòng đăng nhập để tiếp tục.' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        if (!decoded || !Number.isInteger(Number(decoded.id))) {
            return res.status(401).json({ message: 'Thông tin phiên đăng nhập không hợp lệ.' });
        }
        const [users] = await db.query('SELECT id, username, role, status, full_name FROM users WHERE id = ? LIMIT 1', [Number(decoded.id)]);
        if (!users.length || users[0].status !== 'active') {
            return res.status(401).json({ message: 'Tài khoản không tồn tại hoặc đã bị khóa. Vui lòng đăng nhập lại.' });
        }
        req.user = {
            id: users[0].id,
            username: users[0].username,
            role: users[0].role,
            full_name: users[0].full_name
        };
        next();
    } catch (err) {
        if (err && (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError' || err.name === 'NotBeforeError')) {
            return res.status(401).json({ message: 'Phiên đăng nhập hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.' });
        }
        console.error('[Auth middleware]', err);
        return res.status(500).json({ message: 'Không thể xác minh phiên đăng nhập lúc này.' });
    }
};

const checkRole = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Bạn không có quyền thực hiện thao tác này.' });
    }
    next();
};

module.exports = { verifyToken, checkRole, JWT_SECRET };
