// Escape dữ liệu động trước khi ghép vào HTML để giảm nguy cơ XSS.
function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function safeImageURL(value) {
    // Ảnh tải lên từ máy tính được lưu trong public/uploads; API trả về đường dẫn /uploads/...
    // Citizen trước đây chỉ chấp nhận URL http(s), nên ảnh nội bộ bị thay bằng placeholder.
    const isExternalImage = typeof value === 'string' && /^https?:\/\//i.test(value);
    const isUploadedImage = typeof value === 'string' &&
        /^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/i.test(value);
    return isExternalImage || isUploadedImage ? value : 'https://via.placeholder.com/150';
}

const token = localStorage.getItem('token');

let allWantedData = [];
const crimeStatusVN = { wanted: 'Đang truy nã', under_investigation: 'Đang xác minh / điều tra', detained: 'Đã tạm giữ', arrested: 'Đã bắt giữ', prosecuted: 'Đã khởi tố', awaiting_trial: 'Chờ xét xử', convicted: 'Đã kết án', serving_sentence: 'Đang chấp hành án', released: 'Đã được trả tự do', acquitted: 'Được tuyên vô tội', case_suspended: 'Tạm đình chỉ vụ án', case_closed: 'Đã kết thúc xử lý', deceased: 'Đã chết' };
function formatCrimeStatus(status) { return crimeStatusVN[status] || status || 'Chưa cập nhật'; }

// 1. Hàm chuyển đổi Mức độ nguy hiểm sang Tiếng Việt
function formatDangerLevel(level) {
    if (!level) return 'Chưa xác định';
    const lvl = level.toString().toUpperCase().trim();
    switch (lvl) {
        case 'EXTREMELY_DANGEROUS':
        case 'EXTREMELY DANGEROUS':
        case 'SPECIAL':
            return 'Đặc biệt nguy hiểm';
        case 'HIGH':
        case 'DANGEROUS':
            return 'Nguy hiểm';
        case 'MEDIUM':
        case 'MODERATE':
            return 'Trung bình';
        case 'LOW':
            return 'Ít nguy hiểm';
        default:
            return level;
    }
}

// 2. Chuyển đổi qua lại giữa các Tab
function switchTab(tabId, element) {
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
}

// 3. Render danh sách đơn tố giác của cá nhân (Có cột Thao Tác - Nút Xóa)
function renderMyReportsTable(reports) {
    const tableBody = document.getElementById('myReportsTable');
    if (!tableBody) return;

    if (!reports || reports.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:20px;">Bạn chưa gửi đơn tố giác nào.</td></tr>`;
        return;
    }

    tableBody.innerHTML = reports.map(item => {
        let statusBadge = '<span style="color:#f59e0b; font-weight:bold;">⏳ Đang chờ xử lý</span>';
        if (item.status === 'approved' || item.status === 'accepted' || item.status === 'processed') {
            statusBadge = '<span style="color:#10b981; font-weight:bold;">✅ Đã tiếp nhận / Xử lý</span>';
        } else if (item.status === 'rejected') {
            statusBadge = '<span style="color:#ef4444; font-weight:bold;">❌ Từ chối</span>';
        }

        const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : 'N/A';

        return `
            <tr>
                <td><b>${escapeHTML(item.report_code || ('#' + item.id))}</b></td>
                <td>
                    <b>${escapeHTML(item.title || 'Không có tiêu đề')}</b><br>
                    <small style="color:#94a3b8;">📍 ${escapeHTML(item.location || 'Chưa rõ')}</small>
                </td>
                <td>${dateStr}</td>
                <td>${statusBadge}</td>
                <td>
                    ${item.police_note ? `<div style="background:#1e293b; padding:8px; border-radius:4px; border-left:3px solid #3b82f6;">${escapeHTML(item.police_note)}</div>` : '<i style="color:#64748b;">Chưa có phản hồi</i>'}
                </td>
                <td style="text-align: center;">
                    <button class="btn btn-danger" style="padding: 5px 12px; font-size: 13px; background-color: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;" onclick="deleteReport(${item.id})">
                        🗑️ Xóa
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// 4. Render toàn bộ hồ sơ tội phạm cho người dân
function renderWantedTable(dataList) {
    const tableBody = document.getElementById('wantedTable');
    if (!tableBody) return;

    if (!dataList || dataList.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding: 20px;">Không tìm thấy hồ sơ phù hợp.</td></tr>`;
        return;
    }

    tableBody.innerHTML = dataList.map(item => {
        const dangerLevelVN = formatDangerLevel(item.danger_level);

        return `
            <tr>
                <td><img src="${escapeHTML(safeImageURL(item.avatar_url))}" width="50" height="50" style="border-radius:4px; object-fit:cover;"></td>
                <td><b>${escapeHTML(item.full_name || '')}</b><br><small>(${escapeHTML(item.alias || 'Không')})</small></td>
                <td>${escapeHTML(item.crime_type || '')}</td>
                <td>${escapeHTML(item.identifying_marks || 'Chưa cập nhật')}</td>
                <td>${escapeHTML(formatCrimeStatus(item.status))}</td>
                <td><span style="color:#ef4444; font-weight:bold;">${dangerLevelVN}</span></td>
                <td style="text-align: center;">
                    <button class="btn btn-primary" 
                            style="padding: 6px 12px; font-size: 13px; cursor: pointer; background: #0284c7; color: #fff; border: none; border-radius: 6px;" 
                            onclick="viewCrimeDetail(${item.id})">
                        🔍 Xem Chi Tiết
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// 5. Tìm kiếm trong toàn bộ hồ sơ tội phạm
function filterWantedList() {
    const searchInput = document.getElementById('wantedSearchInput');
    if (!searchInput) return;

    const keyword = searchInput.value.toLowerCase().trim();
    if (!keyword) {
        renderWantedTable(allWantedData);
        return;
    }

    const filtered = allWantedData.filter(item => {
        const nameMatch = (item.full_name || '').toLowerCase().includes(keyword);
        const aliasMatch = (item.alias || '').toLowerCase().includes(keyword);
        const crimeMatch = (item.crime_type || '').toLowerCase().includes(keyword);
        const marksMatch = (item.identifying_marks || '').toLowerCase().includes(keyword);
        const statusMatch = formatCrimeStatus(item.status).toLowerCase().includes(keyword);
        const placeMatch = (item.pob || '').toLowerCase().includes(keyword);

        return nameMatch || aliasMatch || crimeMatch || marksMatch || statusMatch || placeMatch;
    });

    renderWantedTable(filtered);
}

// 6. XEM CHI TIẾT ĐỐI TƯỢNG TRUY NÃ (Giao diện chuẩn giống trang Police)
async function viewCrimeDetail(id) {
    const modal = document.getElementById('detailCrimeModal');
    const content = document.getElementById('detailCrimeContent');
    
    if (!modal || !content) {
        console.error("Không tìm thấy modal chi tiết!");
        return;
    }

    // Hiển thị khung chờ
    content.innerHTML = `<div style="text-align:center; width:100%; padding:20px; color:#cbd5e1;">⏳ Đang tải thông tin chi tiết...</div>`;
    modal.style.display = 'flex';

    // Tìm dữ liệu trong danh sách đã tải trước, nếu không tìm thấy mới fetch từ API
    let item = allWantedData.find(x => x.id == id);

    if (!item) {
        try {
            const res = await fetch(`/api/public/crimes/${id}`);
            if (res.ok) {
                const resData = await res.json();
                item = resData.data || resData;
            }
        } catch (e) {
            console.error("Lỗi tải chi tiết:", e);
        }
    }

    if (!item) {
        content.innerHTML = `<div style="color:#ef4444; text-align:center; width:100%;">❌ Không tìm thấy thông tin đối tượng này.</div>`;
        return;
    }

    const formattedLevel = formatDangerLevel(item.danger_level);

    // Giao diện chi tiết thiết kế chuẩn Police
    content.innerHTML = `
        <div style="flex-shrink: 0; text-align: center;">
            <img src="${escapeHTML(safeImageURL(item.avatar_url))}" 
                 style="width: 150px; height: 180px; object-fit: cover; border-radius: 8px; border: 2px solid #0284c7; box-shadow: 0 4px 6px rgba(0,0,0,0.3);" 
                 onerror="this.src='https://via.placeholder.com/150'">
            <div style="margin-top: 10px; font-weight: bold; color: #ef4444; font-size: 13px;">
                TRẠNG THÁI: ${escapeHTML(formatCrimeStatus(item.status)).toUpperCase()}<br>MỨC ĐỘ: ${formattedLevel.toUpperCase()}
            </div>
        </div>
        <div style="flex-grow: 1; font-size: 14px; line-height: 1.6; color: #f8fafc;">
            <h4 style="margin: 0 0 10px 0; font-size: 18px; color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 6px;">
                ${escapeHTML(item.full_name || 'Chưa rõ họ tên')} ${item.alias ? `(${escapeHTML(item.alias)})` : ''}
            </h4>
            <p style="margin: 4px 0;"><b>Tội danh:</b> <span style="color: #f59e0b;">${escapeHTML(item.crime_type || 'Chưa cập nhật')}</span></p>
            
            <p style="margin: 4px 0;"><b>Quê quán / Nơi sinh:</b> ${escapeHTML(item.pob || 'Chưa cập nhật')}</p>
            <p style="margin: 4px 0;"><b>Đặc điểm nhận dạng:</b> ${escapeHTML(item.identifying_marks || 'Chưa cập nhật')}</p>
            <p style="margin: 4px 0;"><b>Trạng thái hồ sơ:</b> ${escapeHTML(formatCrimeStatus(item.status))}</p>
            <p style="margin: 4px 0;"><b>Mã hồ sơ:</b> #${escapeHTML(item.id)}</p>
            
            <div style="margin-top: 10px; padding: 10px; background: #0f172a; border-radius: 6px; border-left: 3px solid #ef4444; color: #cbd5e1; font-size: 13px;">
                ⚠️ <b>Cảnh báo:</b> Thông tin hiển thị phục vụ tra cứu trong phạm vi dữ liệu của hệ thống. Không tự ý kết luận hoặc có hành động gây nguy hiểm; nếu có thông tin liên quan, hãy liên hệ cơ quan có thẩm quyền.
            </div>
        </div>
    `;
}

// 7. Đóng Modal Chi Tiết
function closeDetailCrimeModal() {
    const modal = document.getElementById('detailCrimeModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Bắt sự kiện click ra ngoài để đóng Modal
window.addEventListener('click', function(event) {
    const modal = document.getElementById('detailCrimeModal');
    if (event.target === modal) {
        closeDetailCrimeModal();
    }
});

// 8. Load dữ liệu toàn bộ trang
async function loadCitizenData() {
    try {
        // Lấy thông tin cá nhân
        const resProf = await fetch('/api/user/profile', { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        if (resProf.ok) {
            const user = await resProf.json();
            const userNameEl = document.getElementById('userName');
            const profFullNameEl = document.getElementById('profFullName');
            const profEmailEl = document.getElementById('profEmail');
            const profPhoneEl = document.getElementById('profPhone');

            if (userNameEl) userNameEl.innerText = user.full_name || '';
            if (profFullNameEl) profFullNameEl.value = user.full_name || '';
            if (profEmailEl) profEmailEl.value = user.email || '';
            if (profPhoneEl) profPhoneEl.value = user.phone || '';
        }

        // Lấy toàn bộ danh sách hồ sơ tội phạm
        const resWanted = await fetch('/api/public/crimes');
        if (resWanted.ok) {
            allWantedData = await resWanted.json();
            renderWantedTable(allWantedData);
            const statTotalWantedEl = document.getElementById('statTotalWanted');
            if (statTotalWantedEl) statTotalWantedEl.innerText = allWantedData.length;
        }

        // Lấy danh sách đơn tố giác cá nhân
        const resReports = await fetch('/api/reports/my-reports', { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        if (resReports.ok) {
            const myReports = await resReports.json();
            renderMyReportsTable(myReports);
            const statMyReportsEl = document.getElementById('statMyReports');
            if (statMyReportsEl) statMyReportsEl.innerText = myReports.length;
        }

    } catch (err) {
        console.error('Lỗi nạp dữ liệu:', err);
    }
}

// 9. Cập nhật hồ sơ cá nhân
async function updateProfile() {
    const full_name = document.getElementById('profFullName')?.value;
    const email = document.getElementById('profEmail')?.value;
    const phone = document.getElementById('profPhone')?.value;

    try {
        const res = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ full_name, email, phone })
        });
        const data = await res.json();
        alert(data.message || 'Cập nhật thành công!');
    } catch (err) {
        console.error('Lỗi cập nhật hồ sơ:', err);
        alert('Không thể cập nhật thông tin cá nhân.');
    }
}

// 10. Đổi mật khẩu
async function changePassword() {
    const old_password = document.getElementById('oldPass')?.value;
    const new_password = document.getElementById('newPass')?.value;

    if (!old_password || !new_password) {
        alert('Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới!');
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
        alert(data.message);
        
        if (res.ok) {
            document.getElementById('oldPass').value = '';
            document.getElementById('newPass').value = '';
        }
    } catch (err) {
        console.error('Lỗi đổi mật khẩu:', err);
        alert('Không thể đổi mật khẩu.');
    }
}

// 11. Gửi đơn tố giác
async function sendReport() {
    const titleEl = document.getElementById('repTitle');
    const locationEl = document.getElementById('repLocation');
    const descEl = document.getElementById('repDesc');
    const anonEl = document.getElementById('repAnon');

    const title = titleEl?.value;
    const location = locationEl?.value;
    const description = descEl?.value;

    if (!title || !description) {
        alert('Vui lòng nhập tiêu đề và nội dung tố giác!');
        return;
    }

    const payload = {
        title,
        location,
        description,
        is_anonymous: anonEl ? anonEl.checked : false
    };

    try {
        const res = await fetch('/api/reports', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        alert((data.message || 'Gửi đơn thành công!') + (data.report_code ? `\nMã tra cứu của bạn: ${data.report_code}` : ''));
        
        loadCitizenData();

        if (titleEl) titleEl.value = '';
        if (locationEl) locationEl.value = '';
        if (descEl) descEl.value = '';
        if (anonEl) anonEl.checked = false;
    } catch (err) {
        console.error('Lỗi gửi đơn tố giác:', err);
        alert('Không thể gửi đơn tố giác!');
    }
}

// 12. Xóa đơn tố giác
async function deleteReport(reportId) {
    if (!confirm('Bạn có chắc chắn muốn xóa đơn tố giác này khỏi lịch sử không?')) {
        return;
    }

    try {
        const res = await fetch(`/api/reports/${reportId}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${token}` 
            }
        });

        const data = await res.json();

        if (res.ok && (data.success || res.status === 200)) {
            alert(data.message || 'Xóa đơn tố giác thành công!');
            loadCitizenData();
        } else {
            alert(data.message || 'Không thể xóa đơn tố giác này.');
        }
    } catch (err) {
        console.error('Lỗi khi xóa:', err);
        alert('Có lỗi xảy ra khi kết nối máy chủ!');
    }
}

// Khởi chạy nạp dữ liệu ban đầu
loadCitizenData();