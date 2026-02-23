/* ===========================
   LOGIN PAGE JS – login.js
   =========================== */

(function () {

    /* ---- Multi-role Demo: Login page is always accessible ---- */
    /* (Removed auto-redirect to allow logging in to multiple roles in different tabs) */

    /* ---- DOM refs ---- */
    const loginForm = document.getElementById('login-form');
    const inpUID = document.getElementById('login-uid');
    const inpPass = document.getElementById('login-password');
    const btnLogin = document.getElementById('btn-login');
    const loginBtnText = document.getElementById('login-btn-text');
    const loginBtnIcon = document.getElementById('login-btn-icon');
    const loginSpinner = document.getElementById('login-spinner');

    const errUid = document.getElementById('err-uid');
    const errPass = document.getElementById('err-password');
    const authErrorBox = document.getElementById('auth-error-box');
    const authErrorText = document.getElementById('auth-error-text');
    const roleDetectedBox = document.getElementById('role-detected-box');
    const roleDetectedIcon = document.getElementById('role-detected-icon');
    const roleDetectedText = document.getElementById('role-detected-text');

    const togglePassBtn = document.getElementById('toggle-pass');
    const eyeIcon = document.getElementById('eye-icon');

    /* ---- Show/hide password ---- */
    let passVisible = false;
    togglePassBtn.addEventListener('click', () => {
        passVisible = !passVisible;
        inpPass.type = passVisible ? 'text' : 'password';
        eyeIcon.innerHTML = passVisible
            ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`
            : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
    });

    /* ---- Role detection as user types UID ---- */
    inpUID.addEventListener('input', () => {
        const uid = inpUID.value.trim();
        authErrorBox.classList.remove('show');

        if (!uid) {
            roleDetectedBox.classList.remove('show');
            return;
        }

        const user = KAK_USERS[uid];
        if (user) {
            const meta = ROLE_META[user.role] || {};
            roleDetectedIcon.textContent = meta.icon || '👤';
            roleDetectedText.textContent = `Signing in as ${meta.label || user.role}: ${user.name}`;
            roleDetectedBox.classList.add('show');
        } else {
            roleDetectedBox.classList.remove('show');
        }
    });

    /* ---- Role pill filter (cosmetic) ---- */
    document.querySelectorAll('.role-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.role-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            // Fill UID hint based on role pill
            const role = pill.dataset.role;
            const fillMap = {
                student: '123',
                supervisor: 'sup',
                ao: 'ao',
                vendor: 'ven',
            };
            if (role !== 'all' && fillMap[role]) {
                inpUID.value = fillMap[role];
                inpUID.dispatchEvent(new Event('input'));
                inpPass.focus();
            }
        });
    });

    /* ---- Form Validation ---- */
    function validate() {
        let ok = true;

        if (!inpUID.value.trim()) {
            errUid.textContent = 'Please enter your UID.';
            errUid.classList.add('show');
            inpUID.classList.add('error');
            ok = false;
        } else {
            errUid.classList.remove('show');
            inpUID.classList.remove('error');
        }

        if (!inpPass.value) {
            errPass.textContent = 'Please enter your password.';
            errPass.classList.add('show');
            inpPass.classList.add('error');
            ok = false;
        } else {
            errPass.classList.remove('show');
            inpPass.classList.remove('error');
        }

        return ok;
    }

    /* ---- Submit ---- */
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authErrorBox.classList.remove('show');

        if (!validate()) return;

        // Show spinner
        btnLogin.disabled = true;
        loginBtnText.textContent = 'Signing in…';
        loginBtnIcon.style.display = 'none';
        loginSpinner.classList.add('show');

        // Simulate small auth delay
        await new Promise(r => setTimeout(r, 900));

        const uid = inpUID.value.trim();
        const pass = inpPass.value;
        const user = kakLogin(uid, pass);

        if (!user) {
            // Auth failed
            loginSpinner.classList.remove('show');
            loginBtnIcon.style.display = '';
            loginBtnText.textContent = 'Sign In';
            btnLogin.disabled = false;

            authErrorText.textContent = 'Invalid UID or password. Please check and try again.';
            authErrorBox.classList.add('show');
            inpUID.classList.add('error');
            inpPass.classList.add('error');
            inpPass.value = '';
            inpPass.focus();
            return;
        }

        // Auth success — save session
        kakSetSession(user);

        loginBtnText.textContent = 'Success! Redirecting…';
        await new Promise(r => setTimeout(r, 400));

        // Redirect to correct portal
        redirectByRole(user.role, user.uid);
    });

    /* ---- Redirect by role ---- */
    function redirectByRole(role, uid) {
        const user = KAK_USERS[uid];
        if (user && user.redirectTo) {
            window.location.href = user.redirectTo + '?uid=' + uid;
            return;
        }

        const routes = {
            student: 'student/index.html',
            supervisor: 'supervisor/index.html',
            ao: 'ao/index.html',
            vendor: 'vendor/index.html',
            admin: 'master/index.html'
        };
        const dest = routes[role] || 'student/index.html';
        window.location.href = dest + '?uid=' + uid;
    }

    /* ---- Clear errors on re-type ---- */
    inpUID.addEventListener('input', () => {
        inpUID.classList.remove('error');
        errUid.classList.remove('show');
    });
    inpPass.addEventListener('input', () => {
        inpPass.classList.remove('error');
        errPass.classList.remove('show');
    });

    /* ---- Enter key on UID field → focus password ---- */
    inpUID.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); inpPass.focus(); }
    });

})();
