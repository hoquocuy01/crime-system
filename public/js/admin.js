function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

const token = localStorage.getItem('token');

// Kiểm tra phiên đăng nhập
if (!token) {
    alert('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại!');
    window.location.href = '/login.html';
}

// 1. Chuyển Tab trên Sidebar
function switchTab(tabId, element) {
    try {
        const allTabs = document.querySelectorAll('.tab-content');
        allTabs.forEach(tab => tab.classList.remove('active'));

        const allButtons = document.querySelectorAll('.menu-btn');
        allButtons.forEach(btn => btn.classList.remove('active'));

        const selectedTab = document.getElementById(tabId);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }

        if (element) {
            element.classList.add('active');
        }
    } catch (err) {
        console.error('Lỗi khi chuyển Tab:', err);
    }
}

// 2. Khởi tạo nạp dữ liệu Admin
async function loadAdminData() {
    await Promise.all([
        loadAdminStats(),
        loadUsers()
    ]);
}

// 3. Nạp dữ liệu Thống kê Trang chủ
async function loadAdminStats() {
    try {
        const resStats = await fetch('/api/admin/stats', { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });

        if (!resStats.ok) throw new Error(`HTTP error ${resStats.status}`);

        const stats = await resStats.json();
        
        document.getElementById('statCrimes').innerText = stats.total_crimes ?? stats.totalCrimes ?? 0;
        document.getElementById('statWanted').innerText = stats.total_wanted ?? stats.totalWanted ?? 0;
        document.getElementById('statReports').innerText = stats.total_reports ?? stats.totalReports ?? 0;
    } catch (err) {
        console.error('Lỗi nạp thống kê admin:', err);
    }
}

// 4. Tải danh sách người dùng Toàn hệ thống
async function loadUsers() {
    try {
        const res = await fetch('/api/admin/users', { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });

        const usersTable = document.getElementById('usersTable');
        if (!usersTable) return;

        if (!res.ok) {
            usersTable.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444;">Không thể tải danh sách tài khoản.</td></tr>`;
            return;
        }

        const users = await res.json();

        if (!Array.isArray(users) || users.length === 0) {
            usersTable.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color: #94a3b8;">Chưa có tài khoản nào trong hệ thống.</td></tr>`;
            return;
        }

        // Thêm tham số `index` vào hàm map để hiển thị Số Thứ Tự
        usersTable.innerHTML = users.map((u, index) => {
            const roleBadge = u.role === 'admin' 
                ? '<span style="background:#0284c7; color:#fff; padding:2px 8px; border-radius:4px;">ADMIN</span>' 
                : (u.role === 'police' 
                    ? '<span style="background:#eab308; color:#fff; padding:2px 8px; border-radius:4px;">CẢNH SÁT</span>' 
                    : '<span style="background:#64748b; color:#fff; padding:2px 8px; border-radius:4px;">CÔNG DÂN</span>');

            const statusBadge = u.status === 'active' 
                ? '<span style="color:#22c55e; font-weight:bold;">🟢 Hoạt động</span>' 
                : '<span style="color:#ef4444; font-weight:bold;">🔴 Đã khóa</span>';

            const badgeAndUnit = u.role === 'police' 
                ? `<small>${escapeHTML(u.badge_number || 'Chưa cấp')} - ${escapeHTML(u.unit || 'Chưa xếp')}</small>` 
                : '-';

            const actionBtn = u.role === 'admin' 
                ? '<i>N/A</i>' 
                : (u.status === 'active' 
                    ? `<button class="btn btn-danger" onclick="toggleUserStatus(${u.id}, 'blocked')">Khóa</button>` 
                    : `<button class="btn btn-primary" onclick="toggleUserStatus(${u.id}, 'active')">Mở Khóa</button>`);

            return `
                <tr>
                    <td><b>${index + 1}</b></td> <!-- Cột STT tăng dần tự động: 1, 2, 3, 4 -->
                    <td><b>${escapeHTML(u.username)}</b></td>
                    <td>${escapeHTML(u.full_name || u.fullName || 'N/A')}</td>
                    <td>${roleBadge}</td>
                    <td>${badgeAndUnit}</td>
                    <td>${statusBadge}</td>
                    <td>${actionBtn}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Lỗi nạp danh sách tài khoản:', err);
    }
}

// 5. Cấp tài khoản Cảnh sát mới
async function createPoliceAccount() {
    const username = document.getElementById('admPolUser').value.trim();
    const password = document.getElementById('admPolPass').value.trim();
    const full_name = document.getElementById('admPolName').value.trim();
    const badge_number = document.getElementById('admPolBadge').value.trim();
    const unit = document.getElementById('admPolUnit').value.trim();

    if (!username || !password || !full_name) {
        alert('Vui lòng điền đầy đủ Tên đăng nhập, Mật khẩu và Họ tên cán bộ!');
        return;
    }

    try {
        const res = await fetch('/api/admin/users/create-police', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ username, password, full_name, badge_number, unit })
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
            alert(data.message || 'Cấp tài khoản cán bộ cảnh sát thành công!');
            // Xóa rỗng các ô input
            document.getElementById('admPolUser').value = '';
            document.getElementById('admPolPass').value = '';
            document.getElementById('admPolName').value = '';
            document.getElementById('admPolBadge').value = '';
            document.getElementById('admPolUnit').value = '';
            
            loadUsers();
            switchTab('tab-users'); // Chuyển sang tab danh sách tài khoản
        } else {
            alert(data.message || 'Không thể tạo tài khoản!');
        }
    } catch (err) {
        console.error('Lỗi khi tạo tài khoản cảnh sát:', err);
        alert('Có lỗi xảy ra khi kết nối máy chủ!');
    }
}

// 6. Khóa / Mở khóa tài khoản (Vẫn giữ u.id để Backend xử lý API chính xác)
async function toggleUserStatus(id, status) {
    const actionText = status === 'blocked' ? 'KHÓA' : 'MỞ KHÓA';
    if (!confirm(`Bạn có chắc chắn muốn ${actionText} tài khoản này?`)) return;

    try {
        const res = await fetch(`/api/admin/users/${id}/toggle-status`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ status })
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            alert(data.message || `Đã ${actionText.toLowerCase()} tài khoản thành công!`);
            loadUsers();
        } else {
            alert(data.message || 'Không thể cập nhật trạng thái tài khoản!');
        }
    } catch (err) {
        console.error('Lỗi thay đổi trạng thái user:', err);
        alert('Không thể thực hiện thao tác!');
    }
}

// 7. Đổi mật khẩu Admin
async function changeAdminPassword() {
    const old_password = document.getElementById('admOldPass').value;
    const new_password = document.getElementById('admNewPass').value;

    if (!old_password || !new_password) {
        alert('Vui lòng điền đầy đủ mật khẩu cũ và mới!');
        return;
    }

    try {
        const res = await fetch('/api/user/change-password', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ old_password, new_password })
        });

        const data = await res.json();
        alert(data.message || 'Đã đổi mật khẩu Admin thành công!');

        if (res.ok) {
            document.getElementById('admOldPass').value = '';
            document.getElementById('admNewPass').value = '';
        }
    } catch (err) {
        console.error('Lỗi đổi mật khẩu Admin:', err);
        alert('Có lỗi xảy ra khi đổi mật khẩu!');
    }
}



// Quản lý hồ sơ tội phạm: admin xem toàn bộ và thêm hồ sơ mới.
const adminCrimeStatusLabels = {
    wanted: 'Đang truy nã',
    under_investigation: 'Đang xác minh / điều tra',
    detained: 'Đã tạm giữ',
    arrested: 'Đã bắt giữ',
    prosecuted: 'Đã khởi tố',
    awaiting_trial: 'Chờ xét xử',
    convicted: 'Đã kết án',
    serving_sentence: 'Đang chấp hành án',
    released: 'Đã được trả tự do',
    acquitted: 'Được tuyên vô tội',
    case_suspended: 'Tạm đình chỉ vụ án',
    case_closed: 'Đã kết thúc xử lý',
    deceased: 'Đã chết',
};
const adminCrimeDangerLabels = {
    low: 'Thấp', medium: 'Trung bình', high: 'Cao', extremely_dangerous: 'Đặc biệt nguy hiểm'
};
function safeAdminAvatar(url) {
    if (typeof url === 'string' && (/^https?:\/\//i.test(url) || /^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/i.test(url))) return url;
    return 'https://via.placeholder.com/48?text=No+Photo';
}
async function loadAdminCrimes() {
    const tbody = document.getElementById('adminCrimesTable');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Đang tải danh sách...</td></tr>';
    try {
        const res = await fetch('/api/crimes', { headers: { Authorization: `Bearer ${token}` } });
        const crimes = await res.json().catch(() => []);
        if (!res.ok) throw new Error(crimes.message || 'Không tải được danh sách hồ sơ.');
        if (!Array.isArray(crimes) || !crimes.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:18px;">Chưa có hồ sơ tội phạm.</td></tr>';
            return;
        }
        tbody.innerHTML = crimes.map(c => `<tr>
            <td>#${Number(c.id)}</td>
            <td><img src="${escapeHTML(safeAdminAvatar(c.avatar_url))}" alt="Ảnh" style="width:42px;height:42px;object-fit:cover;border-radius:50%;" onerror="this.onerror=null;this.src='https://via.placeholder.com/48?text=No+Photo'"></td>
            <td>${escapeHTML(c.full_name || '')}</td><td>${escapeHTML(c.alias || '—')}</td>
            <td>${escapeHTML(c.crime_type || '—')}</td>
            <td>${escapeHTML(adminCrimeStatusLabels[c.status] || c.status || '—')}</td>
            <td>${escapeHTML(adminCrimeDangerLabels[c.danger_level] || c.danger_level || '—')}</td>
        </tr>`).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#f87171;">${escapeHTML(err.message || 'Lỗi tải dữ liệu.')}</td></tr>`;
    }
}
function openAdminCrimeForm() {
    document.getElementById('adminCrimeForm')?.reset();
    const modal = document.getElementById('adminCrimeModal');
    if (modal) modal.style.display = 'block';
}
function closeAdminCrimeForm() {
    const modal = document.getElementById('adminCrimeModal');
    if (modal) modal.style.display = 'none';
}
async function createAdminCrime(event) {
    event.preventDefault();
    const button = document.getElementById('admCrimeSubmit');
    const full_name = document.getElementById('admCrimeName').value.trim();
    const file = document.getElementById('admCrimeAvatar').files[0];
    if (!full_name || !document.getElementById('admCrimeType').value.trim()) {
        alert('Vui lòng nhập họ tên và tội danh.'); return;
    }
    if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
        alert('Ảnh phải là JPG, PNG hoặc WebP và không vượt quá 5 MB.'); return;
    }
    button.disabled = true;
    try {
        let avatar_url = '';
        if (file) {
            const formData = new FormData(); formData.append('avatar', file);
            const uploadRes = await fetch('/api/upload/avatar', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
            const uploadData = await uploadRes.json().catch(() => ({}));
            if (!uploadRes.ok) throw new Error(uploadData.message || 'Không tải được ảnh.');
            avatar_url = uploadData.avatar_url || '';
        }
        const payload = {
            full_name,
            alias: document.getElementById('admCrimeAlias').value.trim(),
            identity_card: document.getElementById('admCrimeIdentity').value.trim(),
            dob: document.getElementById('admCrimeDob').value || null,
            pob: document.getElementById('admCrimePob').value.trim(),
            identifying_marks: document.getElementById('admCrimeMarks').value.trim(),
            crime_type: document.getElementById('admCrimeType').value.trim(),
            status: document.getElementById('admCrimeStatus').value,
            danger_level: document.getElementById('admCrimeDanger').value,
            avatar_url
        };
        const res = await fetch('/api/crimes', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Không thêm được hồ sơ.');
        alert(data.message || 'Đã thêm hồ sơ tội phạm.');
        closeAdminCrimeForm();
        await loadAdminCrimes();
        loadAdminStats();
    } catch (err) {
        alert(err.message || 'Có lỗi khi thêm hồ sơ.');
    } finally {
        button.disabled = false;
    }
}

// Thực thi chạy nạp dữ liệu khi trang load xong
document.addEventListener('DOMContentLoaded', () => {
    loadAdminData();
});