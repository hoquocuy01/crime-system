function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function safeCrimeImageURL(value) {
    return typeof value === 'string' && (/^https?:\/\//i.test(value) || /^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/i.test(value)) ? value : 'https://via.placeholder.com/150';
}

const token = localStorage.getItem('token');

// Bảng dịch Trạng thái
const statusMap = {
    'wanted': 'Đang truy nã',
    'under_investigation': 'Đang xác minh / điều tra',
    'detained': 'Đã tạm giữ',
    'arrested': 'Đã bắt giữ',
    'prosecuted': 'Đã khởi tố',
    'awaiting_trial': 'Chờ xét xử',
    'convicted': 'Đã kết án',
    'serving_sentence': 'Đang chấp hành án',
    'released': 'Đã được trả tự do',
    'acquitted': 'Được tuyên vô tội',
    'case_suspended': 'Tạm đình chỉ vụ án',
    'case_closed': 'Đã kết thúc xử lý',
    'deceased': 'Đã chết',
};

// Bảng dịch Mức độ nguy hiểm
const dangerLevelMap = {
    'low': 'Thấp',
    'medium': 'Trung bình',
    'high': 'Cao',
    'extremely_dangerous': 'Đặc biệt nguy hiểm'
};

// Kiểm tra Token ngay khi vào trang
if (!token) {
    alert('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại!');
    window.location.href = '/login.html';
}

// Biến lưu danh sách tội phạm để tra cứu chi tiết nhanh
let currentCrimesList = [];
let editingCrimeId = null;
let currentCrimeAvatarUrl = null;

// 1. Hàm chuyển Tab trên Sidebar
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

// 2. Hàm khởi tạo tải toàn bộ dữ liệu
async function loadPoliceData() {
    await Promise.all([
        loadPoliceProfile(),
        loadPoliceReports(),
        loadCrimes()
    ]);
}

// 3. Tải thông tin Cán bộ
async function loadPoliceProfile() {
    try {
        const res = await fetch('/api/user/profile', { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const user = await res.json();
        console.log('Thông tin cán bộ:', user);
        const badgeEl = document.getElementById('policeBadge');
        const nameEl = document.getElementById('polFullName');
        const unitEl = document.getElementById('polUnit');
        const fullName = user.full_name || user.fullName || user.username || 'Cán bộ';
        const badgeNumber = user.badge_number || user.badgeNumber || 'CS-8892';
        const unit = user.unit || '';
        if (badgeEl) badgeEl.innerText = `CÁN BỘ: ${fullName} (${badgeNumber})`;
        if (nameEl) nameEl.value = fullName;
        if (unitEl) unitEl.value = unit;
    } catch (err) {
        console.error('Lỗi nạp thông tin cán bộ:', err);
    }
}

// 4. Tải danh sách đơn tố giác & Cập nhật thống kê
async function loadPoliceReports() {
    try {
        const res = await fetch('/api/police/reports', { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        const tableBody = document.getElementById('policeReportsTable');
        const statReports = document.getElementById('statPendingReports');
        if (!res.ok) {
            console.warn('API /api/police/reports trả về lỗi:', res.status);
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: #ef4444;">Không thể tải dữ liệu tố giác (Lỗi ${res.status}).</td></tr>`;
            return;
        }
        const reports = await res.json();
        console.log('Danh sách tố giác:', reports);
        
        const pendingList = Array.isArray(reports) ? reports.filter(r => r.status === 'pending') : [];
        if (statReports) {
            statReports.innerText = pendingList.length > 0 ? pendingList.length : (Array.isArray(reports) ? reports.length : 0);
        }
        if (!tableBody) return;
        if (!Array.isArray(reports) || reports.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: #94a3b8;">Hiện tại chưa có đơn tố giác nào.</td></tr>`;
            return;
        }
        tableBody.innerHTML = reports.map(r => {
            const code = r.report_code || r.reportCode || `#${r.id}`;
            const citizenName = r.is_anonymous ? '<i>Ẩn danh</i>' : (r.citizen_name || r.full_name || 'Công dân');
            const phone = r.citizen_phone || r.phone || 'N/A';
            const title = r.title || 'Không có tiêu đề';
            const desc = r.description || '';
            const location = r.location || 'N/A';
            const status = (r.status || 'pending').toUpperCase();
            return `
                <tr>
                    <td><b>${escapeHTML(code)}</b></td>
                    <td>${escapeHTML(citizenName)} <br><small style="color:#94a3b8;">${escapeHTML(phone)}</small></td>
                    <td><b>${escapeHTML(title)}</b><br><small style="color: #94a3b8;">${escapeHTML(desc)}</small></td>
                    <td>📍 ${escapeHTML(location)}</td>
                    <td><b style="color:#f59e0b;">${status}</b></td>
                    <td>
                        <button class="btn btn-primary" style="margin-right: 5px;" onclick="updateReportStatus(${r.id}, 'approved')">Duyệt</button>
                        <button class="btn btn-danger" onclick="updateReportStatus(${r.id}, 'rejected')">Từ Chối</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Lỗi tải danh sách tố giác:', err);
    }
}

// 5. Cập nhật trạng thái đơn tố giác
async function updateReportStatus(id, status) {
    const actionText = status === 'approved' ? 'DUYỆT' : 'TỪ CHỐI';
    const note = prompt(`Nhập ghi chú / phản hồi cho đơn này (khi ${actionText}):`);
    
    if (note === null) return;
    try {
        const res = await fetch(`/api/police/reports/${id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ status, police_note: note })
        });
        const data = await res.json();
        alert(data.message || 'Đã cập nhật trạng thái đơn!');
        loadPoliceReports();
    } catch (err) {
        console.error('Lỗi cập nhật đơn:', err);
        alert('Có lỗi xảy ra khi cập nhật đơn!');
    }
}

// 6. Tải danh sách tội phạm & Gắn sự kiện click xem chi tiết
async function loadCrimes() {
    try {
        const res = await fetch('/api/crimes', { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        const tableBody = document.getElementById('crimesTable');
        const statCrimes = document.getElementById('statTotalCrimes');
        if (!res.ok) {
            console.warn('API /api/crimes trả về lỗi:', res.status);
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: #ef4444;">Không thể tải danh sách tội phạm.</td></tr>`;
            return;
        }
        const crimes = await res.json();
        console.log('Danh sách tội phạm:', crimes);
        
        currentCrimesList = Array.isArray(crimes) ? crimes : [];
        if (statCrimes) {
            statCrimes.innerText = currentCrimesList.length;
        }
        if (!tableBody) return;
        if (currentCrimesList.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color: #94a3b8;">Chưa có hồ sơ tội phạm nào.</td></tr>`;
            return;
        }
        
        tableBody.innerHTML = currentCrimesList.map((c, index) => {
            const avatarUrl = safeCrimeImageURL(c.avatar_url || c.avatarUrl);
            const aliasText = c.alias ? ` (${escapeHTML(c.alias)})` : '';

            // Ánh xạ sang Tiếng Việt
            const rawStatus = String(c.status || 'under_investigation').toLowerCase();
            const statusVN = statusMap[rawStatus] || c.status || 'Đang xác minh / điều tra';

            const rawDanger = String(c.danger_level || c.dangerLevel || 'low').toLowerCase();
            const dangerVN = dangerLevelMap[rawDanger] || c.danger_level || 'Thấp';

            return `
                <tr class="crime-row-hover" style="cursor: pointer;" onclick="showCrimeDetail(${c.id})">
                    <td><b>#${index + 1}</b></td>
                    <td>
                        <img src="${escapeHTML(avatarUrl)}" 
                             onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400';" 
                             alt="Avatar" 
                             style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                    </td>
                    <td><b style="color: #38bdf8;">${escapeHTML(c.full_name || c.fullName)}</b>${aliasText}</td>
                    <td>${escapeHTML(c.crime_type || c.crimeType || 'N/A')}</td>
                    <td><b style="color: #38bdf8;">${statusVN}</b></td>
                    <td><b style="color:#ef4444;">${dangerVN.toUpperCase()}</b></td>
                    <td>
                        <button class="btn btn-primary" style="padding: 4px 8px; font-size: 12px; margin-right: 4px;" onclick="event.stopPropagation(); showCrimeDetail(${c.id})">👁️ Xem</button>
                        <button class="btn" style="padding: 4px 8px; font-size: 12px; margin-right: 4px; background:#f59e0b; color:#111827;" onclick="event.stopPropagation(); editCrime(${c.id})">✏️ Sửa</button>
                        <button class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;" onclick="event.stopPropagation(); deleteCrime(${c.id})">🗑️ Xóa</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Lỗi tải danh sách tội phạm:', err);
    }
}

// 7. Hàm hiển thị Chi tiết Tội phạm lên Modal Popup
function showCrimeDetail(crimeId) {
    const crime = currentCrimesList.find(item => item.id === crimeId);
    if (!crime) return;

    const avatarUrl = safeCrimeImageURL(crime.avatar_url || crime.avatarUrl);
    const dobFormatted = crime.dob ? new Date(crime.dob).toLocaleDateString('vi-VN') : 'Chưa cập nhật';

    // Ánh xạ sang Tiếng Việt
    const rawStatus = String(crime.status || 'under_investigation').toLowerCase();
    const statusVN = statusMap[rawStatus] || crime.status || 'Đang xác minh / điều tra';

    const rawDanger = String(crime.danger_level || crime.dangerLevel || 'low').toLowerCase();
    const dangerVN = dangerLevelMap[rawDanger] || crime.danger_level || 'Thấp';

    const detailContent = `
        <div style="flex: 0 0 160px; text-align: center;">
            <img src="${escapeHTML(avatarUrl)}" 
                 onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400';" 
                 style="width: 150px; height: 180px; object-fit: cover; border-radius: 8px; border: 2px solid #334155;">
            <div style="margin-top: 12px;">
                <span style="background: #ef4444; color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                    MỨC: ${dangerVN.toUpperCase()}
                </span>
            </div>
        </div>
        <div style="flex: 1; font-size: 14px; line-height: 1.8;">
            <h2 style="margin: 0 0 10px 0; color: #38bdf8;">${escapeHTML(crime.full_name || crime.fullName)}</h2>
            <p style="margin: 4px 0;"><b>Biệt danh / Tên khác:</b> ${escapeHTML(crime.alias || 'Không có')}</p>
            <p style="margin: 4px 0;"><b>Số CCCD / CMND:</b> ${escapeHTML(crime.identity_card || 'Chưa cập nhật')}</p>
            <p style="margin: 4px 0;"><b>Ngày sinh:</b> ${dobFormatted}</p>
            <p style="margin: 4px 0;"><b>Quê quán / Nơi sinh:</b> ${escapeHTML(crime.pob || 'Chưa cập nhật')}</p>
            <p style="margin: 4px 0;"><b>Tội danh:</b> <span style="color: #f59e0b; font-weight: bold;">${escapeHTML(crime.crime_type || crime.crimeType)}</span></p>
            <p style="margin: 4px 0;"><b>Trạng thái:</b> <span style="color: #38bdf8; font-weight: bold;">${statusVN}</span></p>
            <p style="margin: 8px 0 4px 0;"><b>Đặc điểm nhận dạng:</b></p>
            <div style="background: #0f172a; padding: 10px 12px; border-radius: 6px; border: 1px solid #334155; color: #cbd5e1; min-height: 45px;">
                ${escapeHTML(crime.identifying_marks || 'Không có mô tả chi tiết.')}
            </div>
        </div>
    `;

    document.getElementById('detailCrimeContent').innerHTML = detailContent;
    document.getElementById('detailCrimeModal').style.display = 'flex';
}

function closeDetailCrimeModal() {
    document.getElementById('detailCrimeModal').style.display = 'none';
}

// 8. Xóa hồ sơ tội phạm
async function deleteCrime(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa hồ sơ tội phạm này?')) return;
    try {
        const res = await fetch(`/api/crimes/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            alert(data.message || 'Đã xóa hồ sơ thành công!');
            loadCrimes();
        } else {
            alert(data.message || 'Không thể xóa hồ sơ.');
        }
    } catch (err) {
        console.error('Lỗi xóa tội phạm:', err);
        alert('Lỗi kết nối máy chủ!');
    }
}

// 9. Thêm mới hoặc sửa hồ sơ tội phạm
function openAddCrimeModal() {
    editingCrimeId = null;
    document.getElementById('addCrimeForm').reset();
    currentCrimeAvatarUrl = null;
    resetCrimeAvatarPreview();
    document.getElementById('crimeModalTitle').textContent = '📁 Thêm Hồ Sơ Tội Phạm Mới';
    document.getElementById('crimeSaveButton').textContent = 'Lưu Hồ Sơ';
    document.getElementById('addCrimeModal').style.display = 'flex';
}

function closeAddCrimeModal() {
    document.getElementById('addCrimeModal').style.display = 'none';
    document.getElementById('addCrimeForm').reset();
    editingCrimeId = null;
    currentCrimeAvatarUrl = null;
    resetCrimeAvatarPreview();
}

function editCrime(id) {
    const crime = currentCrimesList.find(item => Number(item.id) === Number(id));
    if (!crime) {
        alert('Không tìm thấy hồ sơ cần sửa. Vui lòng tải lại danh sách.');
        return;
    }
    editingCrimeId = Number(id);
    document.getElementById('crimeFullName').value = crime.full_name || crime.fullName || '';
    document.getElementById('crimeAlias').value = crime.alias || '';
    document.getElementById('crimeIdentityCard').value = crime.identity_card || crime.identityCard || '';
    document.getElementById('crimeDob').value = crime.dob ? String(crime.dob).slice(0, 10) : '';
    document.getElementById('crimePob').value = crime.pob || '';
    document.getElementById('crimeType').value = crime.crime_type || crime.crimeType || '';
    document.getElementById('crimeIdentifyingMarks').value = crime.identifying_marks || crime.identifyingMarks || '';
    document.getElementById('crimeStatus').value = crime.status || 'under_investigation';
    document.getElementById('crimeDangerLevel').value = crime.danger_level || crime.dangerLevel || 'low';
    currentCrimeAvatarUrl = crime.avatar_url || crime.avatarUrl || null;
    const avatarPreview = document.getElementById('crimeAvatarPreview');
    document.getElementById('crimeAvatarFile').value = '';
    if (currentCrimeAvatarUrl) { avatarPreview.src = safeCrimeImageURL(currentCrimeAvatarUrl); avatarPreview.style.display = 'block'; }
    else resetCrimeAvatarPreview();
    document.getElementById('crimeModalTitle').textContent = '✏️ Chỉnh Sửa Hồ Sơ Tội Phạm';
    document.getElementById('crimeSaveButton').textContent = 'Lưu Thay Đổi';
    document.getElementById('addCrimeModal').style.display = 'flex';
}

async function handleSaveCrime(e) {
    e.preventDefault();
    const full_name = document.getElementById('crimeFullName').value.trim();
    const alias = document.getElementById('crimeAlias').value.trim() || null;
    const identity_card = document.getElementById('crimeIdentityCard').value.trim() || null;
    const dob = document.getElementById('crimeDob').value || null;
    const pob = document.getElementById('crimePob').value.trim() || null;
    const identifying_marks = document.getElementById('crimeIdentifyingMarks').value.trim() || null;
    const crime_type = document.getElementById('crimeType').value.trim();
    const status = document.getElementById('crimeStatus').value;
    const danger_level = document.getElementById('crimeDangerLevel').value;
    let avatar_url = currentCrimeAvatarUrl;
    const avatarFile = document.getElementById('crimeAvatarFile').files[0];
    if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        try {
            const uploadRes = await fetch('/api/upload/avatar', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const uploadData = await uploadRes.json().catch(() => ({}));
            if (!uploadRes.ok) {
                alert(uploadData.message || 'Không tải được ảnh lên.');
                return;
            }
            avatar_url = uploadData.avatar_url;
        } catch (uploadErr) {
            console.error('Lỗi tải ảnh đại diện:', uploadErr);
            alert('Không thể tải ảnh lên máy chủ. Vui lòng thử lại.');
            return;
        }
    }
    const isEditing = editingCrimeId !== null;
    const url = isEditing ? `/api/crimes/${editingCrimeId}` : '/api/crimes';
    const method = isEditing ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                full_name, alias, identity_card, dob, pob, identifying_marks,
                crime_type, status, danger_level, avatar_url
            })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            alert(data.message || (isEditing ? 'Đã cập nhật hồ sơ!' : 'Đã thêm hồ sơ!'));
            closeAddCrimeModal();
            await loadCrimes();
        } else {
            alert(data.message || (isEditing ? 'Không thể sửa hồ sơ.' : 'Không thể thêm hồ sơ.'));
        }
    } catch (err) {
        console.error('Lỗi lưu hồ sơ tội phạm:', err);
        alert('Lỗi kết nối máy chủ!');
    }
}

// Giữ tên hàm cũ để các chỗ gọi cũ (nếu có) vẫn hoạt động.
async function handleCreateCrime(e) {
    editingCrimeId = null;
    return handleSaveCrime(e);
}

// Xem trước ảnh được chọn và kiểm tra định dạng/kích thước ở phía giao diện.
function resetCrimeAvatarPreview() {
    const preview = document.getElementById('crimeAvatarPreview');
    if (!preview) return;
    preview.removeAttribute('src');
    preview.style.display = 'none';
}

document.getElementById('crimeAvatarFile')?.addEventListener('change', function () {
    const file = this.files && this.files[0];
    const preview = document.getElementById('crimeAvatarPreview');
    if (!file) {
        if (currentCrimeAvatarUrl) {
            preview.src = safeCrimeImageURL(currentCrimeAvatarUrl);
            preview.style.display = 'block';
        } else resetCrimeAvatarPreview();
        return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        alert('Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.');
        this.value = '';
        if (currentCrimeAvatarUrl) { preview.src = safeCrimeImageURL(currentCrimeAvatarUrl); preview.style.display = 'block'; }
        else resetCrimeAvatarPreview();
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        alert('Ảnh không được vượt quá 5 MB.');
        this.value = '';
        if (currentCrimeAvatarUrl) { preview.src = safeCrimeImageURL(currentCrimeAvatarUrl); preview.style.display = 'block'; }
        else resetCrimeAvatarPreview();
        return;
    }
    if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
    const objectUrl = URL.createObjectURL(file);
    preview.dataset.objectUrl = objectUrl;
    preview.src = objectUrl;
    preview.style.display = 'block';
});

// 10. Cập nhật hồ sơ Cán bộ
async function updatePoliceProfile() {
    const full_name = document.getElementById('polFullName').value;
    const unit = document.getElementById('polUnit').value;
    try {
        const res = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ full_name, unit })
        });
        const data = await res.json();
        alert(data.message || 'Đã cập nhật thông tin cán bộ!');
    } catch (err) {
        console.error('Lỗi cập nhật hồ sơ:', err);
        alert('Lỗi khi gửi thông tin cập nhật!');
    }
}

// 11. Đổi mật khẩu
async function changePassword() {
    const old_password = document.getElementById('polOldPass').value;
    const new_password = document.getElementById('polNewPass').value;
    if (!old_password || !new_password) {
        alert('Vui lòng nhập đầy đủ mật khẩu cũ và mới!');
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
        alert(data.message || 'Đã đổi mật khẩu thành công!');
        if (res.ok) {
            document.getElementById('polOldPass').value = '';
            document.getElementById('polNewPass').value = '';
        }
    } catch (err) {
        console.error('Lỗi đổi mật khẩu:', err);
        alert('Có lỗi xảy ra khi đổi mật khẩu!');
    }
}

// Gọi hàm chạy khi trang nạp xong
document.addEventListener('DOMContentLoaded', () => {
    loadPoliceData();
});