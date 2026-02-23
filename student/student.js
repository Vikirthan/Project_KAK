/* ===========================
   STUDENT PORTAL – student.js
   Full dashboard + form logic
   =========================== */

(function () {

    /* =========================================================
       1. AUTH GUARD
    ========================================================= */
    const session = kakGetSession('student');
    if (!session) {
        window.location.href = '../index.html';
        return;
    }

    /* =========================================================
       2. POPULATE NAVBAR
    ========================================================= */
    document.getElementById('nav-name').textContent = session.name;
    document.getElementById('nav-uid').textContent = 'UID: ' + session.uid;
    document.getElementById('nav-avatar').textContent = session.name.charAt(0).toUpperCase();

    // Greeting
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    document.getElementById('greeting-time').textContent = greet;
    document.getElementById('greeting-name').textContent = session.name.split(' ')[0];

    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) kakLogout('student');
    });

    /* =========================================================
       2.1 LIVE TIMER TRACKER
    ========================================================= */
    const studentTimerMap = {}; // ticketId -> interval

    function startStudentLiveTimer(ticketId, deadlineISO, containerId) {
        if (studentTimerMap[ticketId]) clearInterval(studentTimerMap[ticketId]);

        function update() {
            const el = document.getElementById(`timer-${ticketId}`);
            if (!el) {
                clearInterval(studentTimerMap[ticketId]);
                delete studentTimerMap[ticketId];
                return;
            }
            const ms = msUntil(deadlineISO);
            if (ms <= 0) {
                el.textContent = '⏱️ Overdue';
                el.style.color = '#ef4444';
                clearInterval(studentTimerMap[ticketId]);
                return;
            }
            el.textContent = '⏱️ ' + formatCountdown(ms);
            el.style.color = ms < 5 * 60 * 1000 ? '#ef4444' : (ms < 15 * 60 * 1000 ? '#f59e0b' : '#3b82f6');
        }

        update();
        studentTimerMap[ticketId] = setInterval(update, 1000);
    }

    /* =========================================================
       3. VIEW MANAGEMENT (Dashboard ↔ Form)
    ========================================================= */
    const viewDash = document.getElementById('view-dashboard');
    const viewForm = document.getElementById('view-form');

    async function showDashboard() {
        viewForm.classList.remove('active-view');
        viewDash.classList.add('active-view');
        resetForm();
        await renderDashboard();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function showForm() {
        // ── GATE: block if any complaint is awaiting the student's rating ──
        const all = await getComplaints();
        const mine = all.filter(c => c.studentUID === session.uid);
        const needsRating = mine.find(c => c.status === 'pending_approval');

        if (needsRating) {
            showRatingGateToast();
            return;   // do NOT open the form
        }

        viewDash.classList.remove('active-view');
        viewForm.classList.add('active-view');
        prefillStudentDetails();
        setActiveStep(1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /* Rating-gate toast — shown when student tries to open form without rating */
    function showRatingGateToast() {
        let toast = document.getElementById('rating-gate-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'rating-gate-toast';
            toast.className = 'rating-gate-toast';
            toast.innerHTML = `
              <span class="rgt-icon">⭐</span>
              <div class="rgt-body">
                <strong>Rate first!</strong>
                <p>You have a resolved complaint waiting for your rating. Please approve &amp; rate it before submitting a new one.</p>
              </div>
              <button class="rgt-close" onclick="this.parentElement.classList.remove('show')">✕</button>
            `;
            document.body.appendChild(toast);
        }
        // Force reflow so animation retriggers even on repeated clicks
        toast.classList.remove('show');
        void toast.offsetWidth;
        toast.classList.add('show');

        // Auto-hide after 5 s
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 5000);
    }


    /* ---- Pre-fill student info from profile ---- */
    function prefillStudentDetails() {
        const profile = STUDENT_PROFILES[session.uid];
        if (!profile) return;

        const nameEl = document.getElementById('student-name');
        const regEl = document.getElementById('reg-no');
        const phoneEl = document.getElementById('phone');

        if (nameEl) { nameEl.value = profile.name; lockField(nameEl); }
        if (regEl) { regEl.value = profile.regNo; lockField(regEl); }
        if (phoneEl) { phoneEl.value = profile.phone; lockField(phoneEl); }
    }

    /* Lock a field — read-only, no editing allowed */
    function lockField(input) {
        input.setAttribute('readonly', true);
        input.classList.add('field-locked');
        // Block any attempt to type
        input.addEventListener('keydown', e => e.preventDefault());
        input.addEventListener('paste', e => e.preventDefault());
    }

    // Buttons that open the form
    document.getElementById('btn-open-form').addEventListener('click', showForm);
    const btn2 = document.getElementById('btn-open-form-2');
    if (btn2) btn2.addEventListener('click', showForm);

    // Back button inside form → go to dashboard
    document.getElementById('btn-back-to-dash').addEventListener('click', showDashboard);

    // Expose to window for success-screen buttons
    window.goToDashboard = showDashboard;
    window.resetFormView = () => {
        document.getElementById('success-screen').classList.remove('show');
        document.getElementById('complaint-form').style.display = '';
        document.getElementById('progress-steps').style.display = '';
        document.getElementById('info-box').style.display = '';
        resetForm();
    };

    /* =========================================================
       4. DASHBOARD — Stats & Complaint List
    ========================================================= */
    async function getMyComplaints() {
        const all = await getComplaints();
        return all.filter(c => c.studentUID === session.uid);
    }

    async function renderDashboard() {
        const mine = await getMyComplaints();

        // ── AUTO-POP: if any complaint awaits rating, prompt immediately ──
        const needsRating = mine.find(c => c.status === 'pending_approval');
        if (needsRating) {
            // Show toast right away
            showRatingGateToast();
            // Open the rating modal after a short delay so the user sees the dashboard first
            setTimeout(() => openRatingModal(needsRating.ticketId), 1200);
        }

        // ---- Stats ----
        const total = mine.length;
        const resolved = mine.filter(c => c.status === 'resolved' || c.status === 'closed').length;
        const missed = mine.filter(c => c.status === 'pending_ao' || c.status === 'closed_overdue').length;
        const pending = mine.filter(c => ['pending_supervisor', 'pending_approval'].includes(c.status)).length;

        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-resolved').textContent = resolved;
        document.getElementById('stat-missed').textContent = missed;
        document.getElementById('stat-pending').textContent = pending;
        document.getElementById('complaint-count-badge').textContent = total + ' total';


        // ---- Complaint list ----
        const listEl = document.getElementById('complaints-list');
        const emptyEl = document.getElementById('empty-state');
        listEl.innerHTML = '';

        if (mine.length === 0) {
            emptyEl.style.display = '';
            listEl.style.display = 'none';
        } else {
            emptyEl.style.display = 'none';
            listEl.style.display = '';

            // Sort newest first
            const sorted = [...mine].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

            sorted.forEach(c => {
                const card = createComplaintCard(c);
                listEl.appendChild(card);
            });
        }
    }

    // Status label map
    const STATUS_META = {
        pending_acceptance: { label: '🆕 Awaiting Acceptance (10m)', cls: 'status-pending_supervisor' },
        pending_supervisor: { label: '🕐 Resolution – Active (30m)', cls: 'status-pending_supervisor' },
        pending_approval: { label: '🔔 Action Required – Approve', cls: 'status-pending_ao' },
        pending_ao: { label: '⚠️ Escalated – AO Office (30m)', cls: 'status-pending_ao' },
        pending_ao_review: { label: '🏢 AO Review Pending', cls: 'status-pending_ao' },
        reported_to_ao: { label: '🚨 Supervisor Reported', cls: 'status-pending_ao' },
        escalated_to_vendor: { label: '👮 Escalated to Vendor', cls: 'status-pending_ao' },
        closed_overdue: { label: '⚫ Closed – Overdue', cls: 'status-pending_ao' },
        resolved: { label: '✅ Resolved', cls: 'status-resolved' },
        closed: { label: '✔ Closed', cls: 'status-closed' },
    };

    // Issue icon map
    const ISSUE_ICONS = {
        'Dirty/Unhygienic': '🚽', 'Water Leakage': '💧', 'Broken Fixture': '🔧',
        'Blocked Drain': '🚫', 'No Water Supply': '❌', 'Bad Odour': '😷',
        'Broken Door/Lock': '🔒', 'Other': '📋'
    };

    function createComplaintCard(c) {
        const meta = STATUS_META[c.status] || { label: c.status, cls: 'status-pending_supervisor' };
        const icon = ISSUE_ICONS[c.issueType] || '📋';
        const date = formatDateTime(new Date(c.submittedAt));
        const block = c.block ? 'Block ' + c.block.replace('-', ' – Floor ') : '–';

        const div = document.createElement('div');
        div.className = 'complaint-card';

        const photoUrl = c.photoUrl || c.photo;
        const approveSection = c.status === 'pending_approval' && (c.supervisorPhoto || c.resolutionPhoto) ? `
          <div class="approve-section">
            <p class="approve-prompt">🔔 Supervisor has resolved your complaint. Please review the photo and approve.</p>
            <img class="resolution-thumb" src="${c.supervisorPhoto || c.resolutionPhoto}" alt="Resolution photo" />
            <div class="approve-actions">
              <button class="btn-approve" data-ticket="${c.ticketId}">✅ Approve & Rate</button>
              <button class="btn-reject" data-ticket="${c.ticketId}">❌ Reject</button>
            </div>
          </div>` : '';

        const ratingSection = c.studentRating ? `
          <div class="rating-given">⭐ You rated: ${'⭐'.repeat(c.studentRating)} (${c.studentRating}/5)</div>` : '';

        let timerHtml = '';
        const deadline = c.acceptanceDeadline || c.supervisorDeadline || c.aoDeadline;
        if (deadline && (c.status === 'pending_acceptance' || c.status === 'pending_supervisor' || c.status === 'pending_ao')) {
            const ms = msUntil(deadline);
            const timeStr = formatCountdown(ms);
            const color = ms < 5 * 60 * 1000 ? '#ef4444' : (ms < 15 * 60 * 1000 ? '#f59e0b' : '#3b82f6');
            timerHtml = `<div class="complaint-bold-timer" id="timer-${c.ticketId}" style="color: ${color};">⏱️ ${timeStr}</div>`;

            // Start the live runner after a tiny delay to ensure card is in DOM
            setTimeout(() => startStudentLiveTimer(c.ticketId, deadline), 50);
        }

        div.innerHTML = `
          <div class="complaint-card-icon">${icon}</div>
          <div class="complaint-card-body">
            <div class="complaint-card-top">
              <div class="complaint-card-header">
                <span class="complaint-block-label">${block}</span>
                <span class="status-badge ${meta.cls}">${meta.label}</span>
              </div>
              ${timerHtml}
            </div>
            <div class="complaint-issue">${c.issueType}${c.description ? ` · ${c.description.slice(0, 60)}${c.description.length > 60 ? '…' : ''}` : ''}</div>
            <div class="complaint-meta">Submitted: ${date} <span class="complaint-ticket-id">${c.ticketId}</span></div>
            ${approveSection}
            ${ratingSection}
          </div>
        `;

        // Approve button → opens star rating modal
        if (c.status === 'pending_approval') {
            div.querySelector('.btn-approve')?.addEventListener('click', () => openRatingModal(c.ticketId));
            div.querySelector('.btn-reject')?.addEventListener('click', () => rejectResolution(c.ticketId));
        }

        return div;
    }

    /* ─── Rating Modal ─── */
    let ratingTicket = null;
    let chosenRating = 0;

    function openRatingModal(ticketId) {
        ratingTicket = ticketId;
        chosenRating = 0;
        renderStars(0);
        document.getElementById('rating-modal').style.display = 'flex';
    }

    function renderStars(n) {
        document.querySelectorAll('.star-btn').forEach((btn, i) => {
            btn.textContent = i < n ? '⭐' : '☆';
        });
    }

    document.querySelectorAll('.star-btn').forEach((btn, i) => {
        btn.addEventListener('mouseover', () => renderStars(i + 1));
        btn.addEventListener('mouseout', () => renderStars(chosenRating));
        btn.addEventListener('click', () => { chosenRating = i + 1; renderStars(chosenRating); });
    });

    document.getElementById('rating-cancel')?.addEventListener('click', () => {
        document.getElementById('rating-modal').style.display = 'none';
    });
    const ratingSubmitBtn = document.getElementById('rating-submit');
    ratingSubmitBtn?.addEventListener('click', async () => {
        if (!chosenRating) { document.getElementById('rating-err').style.display = 'block'; return; }
        document.getElementById('rating-err').style.display = 'none';

        ratingSubmitBtn.disabled = true;
        ratingSubmitBtn.textContent = 'Submitting...';

        const all = await getComplaints();
        const c = all.find(x => x.ticketId === ratingTicket);

        if (chosenRating < 4) {
            // LOW RATING LOGIC: Forward to AO for review
            await updateComplaint(ratingTicket, {
                status: 'pending_ao_review',
                studentRating: chosenRating,
                studentApproved: true,
                timeline: [...(c?.timeline || []), {
                    event: 'Low Rating Review: Forwarded to AO Office (Rated ' + chosenRating + '/5)',
                    time: new Date().toISOString(), by: session.uid
                }]
            });
        } else {
            // NORMAL RESOLUTION: Keep record and photo for history
            await updateComplaint(ratingTicket, {
                status: 'resolved',
                studentRating: chosenRating,
                studentApproved: true,
                timeline: [...(c?.timeline || []), {
                    event: 'Resolution Approved by Student. Rated ' + chosenRating + '/5',
                    time: new Date().toISOString(), by: session.uid
                }]
            });
        }

        // Save rating to supervisor stats
        if (c) await addRatingToStats(c.assignedSupervisor, chosenRating, ratingTicket);

        ratingSubmitBtn.disabled = false;
        ratingSubmitBtn.textContent = 'Submit Rating';

        document.getElementById('rating-modal').style.display = 'none';
        await renderDashboard();
    });

    async function rejectResolution(ticketId) {
        if (!confirm('Reject resolution and send back to supervisor?')) return;
        const all = await getComplaints();
        const c = all.find(x => x.ticketId === ticketId);
        await updateComplaint(ticketId, {
            status: 'pending_supervisor',
            supervisorDeadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // new 30-min window
            resolutionPhoto: null,
            resolvedAt: null,
            timeline: [...(c?.timeline || []), { event: 'Student Rejected Resolution – Reopened', time: new Date().toISOString(), by: session.uid }]
        });
        await renderDashboard();
    }

    // Initial render + Fast Refresh (5s - slowed down for Supabase)
    renderDashboard();
    setInterval(async () => {
        await runEscalationEngine();
        await renderDashboard();
    }, 5000);

    /* =========================================================
       5. COMPLAINT FORM LOGIC
    ========================================================= */
    const form = document.getElementById('complaint-form');
    const inpName = document.getElementById('student-name');
    const inpReg = document.getElementById('reg-no');
    const inpPhone = document.getElementById('phone');
    const selBlock = document.getElementById('block-select');
    const selIssue = document.getElementById('issue-type');
    const txDesc = document.getElementById('description');
    const photoInput = document.getElementById('photo-input');
    const uploadZone = document.getElementById('upload-zone');
    const previewWrap = document.getElementById('photo-preview-wrap');
    const previewImg = document.getElementById('photo-preview-img');
    const removeBtn = document.getElementById('photo-remove-btn');
    const charCount = document.getElementById('char-count');
    const declCheck = document.getElementById('declaration-check');
    const btnSubmit = document.getElementById('btn-submit');
    const submitText = document.getElementById('submit-text');
    const submitSpinner = document.getElementById('submit-spinner');
    const submitIcon = document.getElementById('submit-icon');
    const successScreen = document.getElementById('success-screen');

    // Errors
    const errName = document.getElementById('err-name');
    const errReg = document.getElementById('err-reg');
    const errPhone = document.getElementById('err-phone');
    const errBlock = document.getElementById('err-block');
    const errIssue = document.getElementById('err-issue');
    const errPhoto = document.getElementById('err-photo');
    const errDeclaration = document.getElementById('err-declaration');

    let photoDataURL = null;

    /* ---- Char counter ---- */
    txDesc.addEventListener('input', () => {
        charCount.textContent = txDesc.value.length + ' / 300';
    });

    /* ---- Photo Upload ---- */
    photoInput.addEventListener('change', handlePhotoSelect);

    function handlePhotoSelect(e) {
        const file = (e.target && e.target.files) ? e.target.files[0] : (e.dataTransfer && e.dataTransfer.files[0]);
        if (!file) return;
        if (!file.type.startsWith('image/')) { showErr(errPhoto, 'Please select a valid image file.'); return; }
        if (file.size > 10 * 1024 * 1024) { showErr(errPhoto, 'Photo must be under 10 MB.'); return; }
        hideErr(errPhoto);
        const reader = new FileReader();
        reader.onload = ev => {
            photoDataURL = ev.target.result;
            previewImg.src = photoDataURL;
            previewWrap.classList.add('show');
            uploadZone.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    removeBtn.addEventListener('click', () => {
        photoDataURL = null; previewImg.src = '';
        previewWrap.classList.remove('show');
        uploadZone.style.display = 'flex';
        photoInput.value = '';
    });

    uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
    uploadZone.addEventListener('drop', e => {
        e.preventDefault(); uploadZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) handlePhotoSelect({ target: { files: [file] } });
    });

    /* ---- Validation helpers ---- */
    function showErr(el, msg) { if (msg) el.textContent = msg; el.classList.add('show'); }
    function hideErr(el) { el.classList.remove('show'); }

    function validateForm() {
        let ok = true;
        if (!inpName.value.trim() || inpName.value.trim().length < 2) { showErr(errName, 'Please enter your full name.'); ok = false; } else hideErr(errName);
        if (!inpReg.value.trim()) { showErr(errReg, 'Please enter your registration number.'); ok = false; } else hideErr(errReg);
        if (!/^\d{10}$/.test(inpPhone.value.trim())) { showErr(errPhone, 'Enter a valid 10-digit mobile number.'); ok = false; } else hideErr(errPhone);
        if (!selBlock.value) { showErr(errBlock, 'Please select the block and floor.'); ok = false; } else hideErr(errBlock);
        if (!selIssue.value) { showErr(errIssue, 'Please select the issue type.'); ok = false; } else hideErr(errIssue);
        if (!photoDataURL) { showErr(errPhoto, 'Please attach a photo of the issue.'); ok = false; } else hideErr(errPhoto);
        if (!declCheck.checked) { showErr(errDeclaration, 'You must confirm the declaration to proceed.'); ok = false; } else hideErr(errDeclaration);
        return ok;
    }

    /* ---- Real-time validation ---- */
    inpName.addEventListener('blur', () => inpName.value.trim().length >= 2 ? hideErr(errName) : showErr(errName, 'Please enter your full name.'));
    inpReg.addEventListener('blur', () => inpReg.value.trim() ? hideErr(errReg) : showErr(errReg, 'Please enter your registration number.'));
    inpPhone.addEventListener('blur', () => /^\d{10}$/.test(inpPhone.value.trim()) ? hideErr(errPhone) : showErr(errPhone, 'Enter a valid 10-digit mobile number.'));
    selBlock.addEventListener('change', () => selBlock.value ? hideErr(errBlock) : null);
    selIssue.addEventListener('change', () => selIssue.value ? hideErr(errIssue) : null);

    /* ---- Phone number only ---- */
    inpPhone.addEventListener('keypress', e => { if (!/[0-9]/.test(e.key)) e.preventDefault(); });

    /* ---- Progress Steps — Scroll-based ---- */
    // Maps each form card/section → which step number it represents
    const STEP_SECTIONS = [
        { id: 'card-student', step: 1 },
        { id: 'card-location', step: 2 },
        { id: 'card-photo', step: 3 },
        { id: 'declaration-box', step: 4 },
    ];

    function setActiveStep(step) {
        ['step-1', 'step-2', 'step-3', 'step-4'].forEach((id, i) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.remove('active', 'done');
            if (i + 1 < step) el.classList.add('done');
            if (i + 1 === step) el.classList.add('active');
        });
    }

    // Use IntersectionObserver: when a card is >= 30% visible → activate its step
    const stepObserver = new IntersectionObserver(entries => {
        // Find the entry that's most visible and currently intersecting
        let bestStep = null;
        let bestRatio = 0;
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.intersectionRatio >= bestRatio) {
                bestRatio = entry.intersectionRatio;
                const section = STEP_SECTIONS.find(s => s.id === entry.target.id);
                if (section) bestStep = section.step;
            }
        });
        if (bestStep !== null) setActiveStep(bestStep);
    }, {
        root: null,              // viewport
        threshold: [0.15, 0.5], // trigger at 15% and 50% visibility
        rootMargin: '-80px 0px -30% 0px', // offset for sticky nav + progress bar
    });

    // Observe all section cards
    STEP_SECTIONS.forEach(s => {
        const el = document.getElementById(s.id);
        if (el) stepObserver.observe(el);
    });

    // Also update via scroll position as a fallback (for very tall cards)
    window.addEventListener('scroll', () => {
        const viewMid = window.scrollY + window.innerHeight * 0.4;
        let active = 1;
        STEP_SECTIONS.forEach(s => {
            const el = document.getElementById(s.id);
            if (el && el.getBoundingClientRect().top + window.scrollY <= viewMid) {
                active = s.step;
            }
        });
        setActiveStep(active);
    }, { passive: true });



    /* ---- FORM SUBMIT ---- */
    form.addEventListener('submit', async e => {
        e.preventDefault();
        if (!validateForm()) {
            const firstErr = form.querySelector('.field-error.show');
            if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        btnSubmit.disabled = true;
        submitText.textContent = 'Uploading Photo…';
        submitIcon.style.display = 'none';
        submitSpinner.classList.add('show');

        const ticketId = generateTicketId();

        // 1. Upload photo to Supabase Storage
        let finalPhotoURL = photoDataURL;
        if (window.supabaseClient) {
            finalPhotoURL = await uploadPhotoToSupabase(photoDataURL, `${ticketId}_issue.jpg`);
            if (!finalPhotoURL) {
                alert('Photo upload failed. Please try again.');
                btnSubmit.disabled = false;
                submitText.textContent = 'Submit Complaint';
                submitSpinner.classList.remove('show');
                submitIcon.style.display = '';
                return;
            }
        }

        submitText.textContent = 'Registering Complaint…';

        const now = new Date();
        const blockNum = selBlock.value.split('-')[0];

        const complaint = {
            ticketId,
            studentUID: session.uid,
            studentName: inpName.value.trim(),
            regNo: inpReg.value.trim(),
            phone: inpPhone.value.trim(),
            block: selBlock.value,
            issueType: selIssue.value,
            description: txDesc.value.trim(),
            photo: finalPhotoURL,
            status: 'pending_acceptance',
            submittedAt: now.toISOString(),
            acceptanceDeadline: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
            assignedSupervisor: 'SUP-' + blockNum,
            supervisorPhoto: null,
            studentApproved: false,
            escalated: false,
            timeline: [{ event: 'Complaint Registered - Awaiting Supervisor Acceptance', time: now.toISOString(), by: 'student' }]
        };

        // 2. Add to Supabase Table
        console.log('[KAK-DEBUG] Submitting complaint:', {
            ticketId,
            assignedSupervisor: 'SUP-' + blockNum,
            block: selBlock.value
        });

        await addComplaint(complaint);

        submitSpinner.classList.remove('show');
        form.style.display = 'none';
        document.getElementById('progress-steps').style.display = 'none';
        document.getElementById('info-box').style.display = 'none';
        successScreen.classList.add('show');
        document.getElementById('ticket-id-display').textContent = ticketId;
        document.getElementById('tl-submitted-time').textContent = formatDateTime(now);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });


    /* ---- Reset form ---- */
    function resetForm() {
        form.reset();
        photoDataURL = null;
        previewImg.src = '';
        previewWrap.classList.remove('show');
        uploadZone.style.display = 'flex';
        photoInput.value = '';
        charCount.textContent = '0 / 300';
        btnSubmit.disabled = false;
        submitText.textContent = 'Submit Complaint';
        submitIcon.style.display = '';
        submitSpinner.classList.remove('show');
        form.style.display = '';
        document.getElementById('progress-steps').style.display = '';
        document.getElementById('info-box').style.display = '';
        successScreen.classList.remove('show');
        document.getElementById('step-1').classList.add('active');
        ['step-2', 'step-3', 'step-4'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active', 'done');
        });
    }

    /* =========================================================
       6. HANDLE DEEP LINKS (QR CODES)
    ========================================================= */
    function checkDeepLinks() {
        const params = new URLSearchParams(window.location.search);
        const loc = params.get('loc'); // Format: block-36-2floor

        if (loc && loc.startsWith('block-')) {
            // Wait for renderDashboard to finish or just trigger showForm
            setTimeout(async () => {
                const parts = loc.split('-');
                if (parts.length < 3) return;

                const blockNum = parts[1];
                let floorRaw = parts[2]; // e.g. "2floor"

                // Map floor aliases
                const floorMap = {
                    '2floor': '2nd', '3floor': '3rd', '5floor': '5th'
                };
                const floor = floorMap[floorRaw] || floorRaw;
                const targetValue = `${blockNum}-${floor}`;

                // Try to find if this option exists
                const hasOption = Array.from(selBlock.options).some(o => o.value === targetValue);

                if (hasOption) {
                    await showForm(); // This will handle the rating gate

                    // Only if we actually made it to the form
                    if (viewForm.classList.contains('active-view')) {
                        selBlock.value = targetValue;
                        // Dispatch change to trigger any validation/UI updates
                        selBlock.dispatchEvent(new Event('change'));

                        // Scroll to the card-location
                        const locCard = document.getElementById('card-location');
                        if (locCard) locCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }, 800);
        }
    }

    // Run deep link check on load
    checkDeepLinks();

    /* =========================================================
       7. QR SCANNER IMPLEMENTATION
    ========================================================= */
    const qrModal = document.getElementById('qr-modal');
    const btnScanQR = document.getElementById('btn-scan-qr');
    const qrCancel = document.getElementById('qr-cancel');
    let html5QrCode = null;

    if (btnScanQR) {
        btnScanQR.addEventListener('click', () => {
            qrModal.style.display = 'flex';
            startScanner();
        });
    }

    qrCancel.addEventListener('click', stopScanner);

    function startScanner() {
        if (html5QrCode) stopScanner();
        html5QrCode = new Html5Qrcode("qr-reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                // Handle scanned link
                stopScanner();
                try {
                    const url = new URL(decodedText);
                    const loc = url.searchParams.get('loc');
                    if (loc) {
                        window.history.replaceState(null, '', `?loc=${loc}`);
                        checkDeepLinks();
                    } else {
                        alert("Scanned QR but no location found. Please scan the official KAK Restroom QR.");
                    }
                } catch (e) {
                    // Not a URL, check if it's just the location string
                    if (decodedText.startsWith('block-')) {
                        window.history.replaceState(null, '', `?loc=${decodedText}`);
                        checkDeepLinks();
                    } else {
                        alert("Invalid QR Code: " + decodedText);
                    }
                }
            },
            (errorMessage) => { /* ignore constant scan errors */ }
        ).catch(err => {
            console.error("Camera access failed", err);
            alert("Could not access camera. Please ensure permissions are granted.");
            stopScanner();
        });
    }

    function stopScanner() {
        qrModal.style.display = 'none';
        if (html5QrCode) {
            html5QrCode.stop().catch(e => console.error(e));
            html5QrCode = null;
        }
    }

})();
