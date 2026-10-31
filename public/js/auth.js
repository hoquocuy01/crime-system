function toggleAuth(showRegister) {
    document.getElementById('loginForm').style.display = showRegister ? 'none' : 'block';
    document.getElementById('registerForm').style.display = showRegister ? 'block' : 'none';
}

async function login() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        
        // Điều hướng thông minh theo vai trò
        if (data.role === 'citizen') window.location.href = 'citizen.html';
        else if (data.role === 'police') window.location.href = 'police.html';
        else if (data.role === 'admin') window.location.href = 'admin.html';
    } else {
        alert(data.message);
    }
}

async function register() {
    const payload = {
        username: document.getElementById('regUsername').value,
        full_name: document.getElementById('regFullName').value,
        email: document.getElementById('regEmail').value,
        phone: document.getElementById('regPhone').value,
        password: document.getElementById('regPassword').value
    };

    const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    alert(data.message);
    if (data.success) toggleAuth(false);
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}