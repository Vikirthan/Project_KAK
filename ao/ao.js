/* ===========================
   AO OFFICE PORTAL – ao.js
   =========================== */

(function () {
  'use strict';

  /* ── Auth guard ── */
  const session = kakGetSession('ao');
  if (!session) {
    window.location.href = '../index.html';
    return;
  }

  /* ── Run escalation engine on load ── */
  runEscalationEngine();

  // Request Notification permission
  if (Notification.permission !== 'granted') Notification.requestPermission();

  /* ── Navbar ── */
  document.getElementById('nav-name').textContent = session.name;
  document.getElementById('btn-logout').addEventListener('click', () => kakLogout(session.uid));

  /* ── State ── */
  const timerMap = {};
  let lastRenderHash = '';
  const notifiedIds = new Set();

  function triggerNotification(title, body, ticketId) {
    if (Notification.permission === 'granted' && !notifiedIds.has(ticketId)) {
      new Notification(title, {
        body: body,
        icon: '../icon-192.png'
      });
      notifiedIds.add(ticketId);
    }
  }

  /* =========================================================
     RENDER
  ========================================================= */
  async function render() {
    let all = await getComplaints();

    // ── Check if any NEW escalations need notification ──
    const relevantToAo = all.filter(c => c.status === 'pending_ao' || c.status === 'reported_to_ao' || c.status === 'pending_ao_review');
    relevantToAo.forEach(c => {
      if (!notifiedIds.has(c.ticketId)) {
        const title = c.status === 'reported_to_ao' ? "🚨 Supervisor Reported" : "🏢 New Escalation (Tier 1)";
        triggerNotification(title, `Ticket ${c.ticketId} (${c.issueType}) requires immediate AO attention.`, c.ticketId);
      }
    });

    // ── Check if anything actually changed to prevent flickering ──
    if (!KAK.hasListChanged(lastRenderHash, all)) return;
    lastRenderHash = KAK.generateListHash(all);

    // ── Filter by AO's assigned block ──
    if (session.block) {
      all = all.filter(c => c.block && c.block.split('-')[0] === session.block);
      renderSupervisorSummary(session.block);
    }

    const active = all.filter(c => c.status === 'pending_ao');
    const resolved = all.filter(c => c.status === 'ao_resolved' || c.status === 'resolved' || c.status === 'closed');
    const overdue = all.filter(c => c.status === 'closed_overdue');
    const reviews = all.filter(c => c.status === 'pending_ao_review' || c.status === 'reported_to_ao');

    /* Stats */
    const totalEscalated = active.length + resolved.length + overdue.length + reviews.length;
    document.getElementById('stat-escalated').textContent = totalEscalated;
    document.getElementById('stat-active').textContent = active.length;
    document.getElementById('stat-ao-resolved').textContent = resolved.length;
    document.getElementById('stat-overdue').textContent = overdue.length;

    /* Badges */
    document.getElementById('badge-active').textContent = active.length;
    document.getElementById('badge-ao-resolved').textContent = resolved.length;
    document.getElementById('badge-overdue').textContent = overdue.length;
    document.getElementById('badge-review').textContent = reviews.length;
    document.getElementById('stat-review').textContent = reviews.length;

    /* Overdue banner */
    document.getElementById('overdue-banner').style.display = overdue.length ? 'flex' : 'none';

    /* Lists */
    renderList('ao-active-list', 'empty-active', active, renderActiveCard);
    renderList('ao-resolved-list', 'empty-ao-resolved', resolved, renderResolvedCard);
    renderList('ao-overdue-list', 'empty-overdue', overdue, renderOverdueCard);
    renderList('ao-review-list', 'empty-review', reviews, renderReviewCard);
  }

  async function renderSupervisorSummary(block) {
    const sup = Object.values(KAK_USERS).find(u => u.role === 'supervisor' && u.block === block);
    if (!sup) return;

    const stat = await getSupStat(sup.uid);
    const rating = stat.avgRating || 0;
    const complaints = await getComplaintsForSupervisor(sup.uid);

    document.getElementById('perf-ratings').textContent = rating > 0 ? rating : '–';
    document.getElementById('perf-stars').textContent = rating > 0 ? '⭐'.repeat(Math.round(parseFloat(rating))) : '';
    document.getElementById('perf-received').textContent = complaints.length;
    document.getElementById('perf-ontime').textContent = complaints.filter(c => c.resolvedOnTime).length;
    document.getElementById('perf-missed').textContent = complaints.filter(c => c.status === 'closed_overdue' || c.escalated).length;
    document.getElementById('perf-black').textContent = (stat.blackPoints || 0) + ' ⚫';
  }

  function renderList(listId, emptyId, items, cardFn) {
    const container = document.getElementById(listId);
    const emptyEl = document.getElementById(emptyId);

    // Clear old cards
    Array.from(container.children).forEach(el => {
      if (!el.classList.contains('empty-state')) el.remove();
    });

    if (!items.length) { emptyEl.style.display = ''; return; }
    emptyEl.style.display = 'none';
    items.sort((a, b) => new Date(a.aoAlertAt) - new Date(b.aoAlertAt)); // oldest first (most urgent)
    items.forEach(c => container.appendChild(cardFn(c)));
  }

  /* =========================================================
     CARDS
  ========================================================= */
  function renderActiveCard(c) {
    const div = document.createElement('div');
    div.className = 'ao-card';
    div.id = 'aocard-' + c.ticketId;

    div.innerHTML = `
      <div class="ao-card-top">
        <div class="ao-card-left">
          <div class="ao-issue">🚨 ${c.issueType}</div>
          <div class="ao-meta">
            <span>📍 Block ${c.block}</span>
            <span>🎓 ${c.studentName}</span>
            <span>📞 ${c.phone || '–'}</span>
            <span>Escalated: ${c.aoAlertAt ? formatDateTime(new Date(c.aoAlertAt)) : '–'}</span>
          </div>
          <div class="ao-meta">
            <span class="sup-badge">👷 Supervisor: ${c.assignedSupervisor}</span>
          </div>
        </div>
        <div class="ao-card-right">
          <span class="ao-timer-badge" id="ao-timer-${c.ticketId}">⏱ --:--</span>
          <span class="ao-status-pill pill-active">🔴 Requires Action</span>
          <span class="ao-ticket">${c.ticketId}</span>
        </div>
      </div>
      ${c.description ? `<div class="ao-desc">"${c.description}"</div>` : ''}
      ${c.photo ? `<div class="ao-photo-wrap"><img src="${c.photo}" alt="Student Photo" /><span>📷 Student's complaint photo</span></div>` : ''}
      ${c.resolutionPhoto ? `<div class="ao-photo-wrap"><img src="${c.resolutionPhoto}" alt="Supervisor resolution" /><span>📸 Supervisor's resolution photo</span></div>` : ''}
      <div class="ao-card-actions">
        <button class="btn-ao-resolve" data-ticket="${c.ticketId}">✅ Mark AO Resolved</button>
      </div>
    `;

    /* Live timer */
    if (c.aoDeadline) startTimer(c.ticketId, c.aoDeadline, div);

    div.querySelector('.btn-ao-resolve').addEventListener('click', () => openModal(c.ticketId));
    return div;
  }

  function renderResolvedCard(c) {
    const div = document.createElement('div');
    div.className = 'ao-card ao-card-resolved';

    // Find notes from timeline
    const aoTimeline = (c.timeline || []).findLast(t => t.event.includes('AO Cleared Review'));
    const vendorNote = aoTimeline?.vendorNote;
    const studentNote = aoTimeline?.note;

    div.innerHTML = `
      <div class="ao-card-top">
        <div class="ao-card-left">
          <div class="ao-issue">✅ ${c.issueType}</div>
          <div class="ao-meta">
            <span>📍 Block ${c.block}</span>
            <span>🎓 ${c.studentName}</span>
            <span>Resolved: ${c.resolvedAt ? formatDateTime(new Date(c.resolvedAt)) : (c.aoResolvedAt ? formatDateTime(new Date(c.aoResolvedAt)) : '–')}</span>
          </div>
          ${c.studentRating ? `<div class="rating-badge">⭐ Student Rated: ${c.studentRating}/5</div>` : ''}
        </div>
        <div class="ao-card-right">
          <span class="ao-status-pill pill-resolved">${c.status === 'resolved' ? '✅ Resolved' : '✅ AO Resolved'}</span>
          <span class="ao-ticket">${c.ticketId}</span>
        </div>
      </div>

      <!-- Descriptions for Student/Supervisor (Vendor) -->
      ${vendorNote || studentNote ? `
        <div class="ao-notes-box" style="margin-top: 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; border-top: 1px dashed var(--border); padding-top: 12px;">
          ${vendorNote ? `
            <div class="note-item">
              <div style="font-size: 11px; font-weight: 700; color: #818cf8; text-transform: uppercase; letter-spacing: 0.5px;">👮 Note for Supervisor/Vendor:</div>
              <div style="font-size: 13px; color: #cbd5e1; margin-top: 5px; line-height: 1.5; background: rgba(129, 140, 248, 0.08); padding: 10px; border-radius: 8px; border-left: 3px solid #6366f1;">"${vendorNote}"</div>
            </div>
          ` : ''}
          ${studentNote ? `
            <div class="note-item">
              <div style="font-size: 11px; font-weight: 700; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.5px;">🎓 Note for Student:</div>
              <div style="font-size: 13px; color: #cbd5e1; margin-top: 5px; line-height: 1.5; background: rgba(251, 191, 36, 0.08); padding: 10px; border-radius: 8px; border-left: 3px solid #fbbf24;">"${studentNote}"</div>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <div class="ao-photo-summary" style="display:flex; gap:10px; margin-top:12px;">
        ${c.photo ? `<div class="ao-photo-wrap" style="flex:1;"><img src="${c.photo}" style="max-height:80px; width: 100%; object-fit: cover; border-radius: 6px;" alt="Issue" /></div>` : ''}
        ${c.supervisorPhoto || c.resolutionPhoto ? `<div class="ao-photo-wrap" style="flex:1;"><img src="${c.supervisorPhoto || c.resolutionPhoto}" style="max-height:80px; width: 100%; object-fit: cover; border-radius: 6px;" alt="Resolution" /></div>` : ''}
      </div>
    `;
    return div;
  }

  function renderOverdueCard(c) {
    const div = document.createElement('div');
    div.className = 'ao-card ao-card-overdue';
    div.innerHTML = `
      <div class="ao-card-top">
        <div class="ao-card-left">
          <div class="ao-issue">⚫ ${c.issueType}</div>
          <div class="ao-meta">
            <span>📍 Block ${c.block}</span>
            <span>🎓 ${c.studentName}</span>
            <span>Escalated: ${c.aoAlertAt ? formatDateTime(new Date(c.aoAlertAt)) : '–'}</span>
          </div>
          <div class="ao-meta">
            <span class="sup-badge">👷 Supervisor: ${c.assignedSupervisor} — ⚫ 2 Total Black Points</span>
          </div>
        </div>
        <div class="ao-card-right">
          <span class="ao-status-pill pill-overdue">⚫ Overdue</span>
          <span class="ao-ticket">${c.ticketId}</span>
        </div>
      </div>
      ${c.description ? `<div class="ao-desc">"${c.description}"</div>` : ''}
    `;
    return div;
  }

  /* ─────────────────────────────────────────────
     QUALITY REVIEW CARD (< 3 STARS)
  ───────────────────────────────────────────── */
  function renderReviewCard(c) {
    const div = document.createElement('div');
    div.className = 'ao-card card-review';

    const isReported = c.status === 'reported_to_ao';

    div.innerHTML = `
      <div class="ao-card-top">
        <div class="ao-card-left">
          <div class="ao-issue">⚠️ Quality Review Required (${c.studentRating}⭐)</div>
          <div class="ao-meta">
            <span>📍 Block ${c.block}</span>
            <span>🎓 ${c.studentName}</span>
            <span>📞 Student Mobile: <strong>${c.phone || '–'}</strong></span>
          </div>
          <div class="ao-meta">
             <span class="sup-badge">👷 Supervisor: ${c.assignedSupervisor}</span>
          </div>
        </div>
        <div class="ao-card-right">
          <span class="ao-status-pill ${isReported ? 'status-summoned' : 'pill-active'}">
             ${isReported ? '🔴 SUPERVISOR REPORTED' : '🟡 Low Rating given'}
          </span>
          <span class="ao-ticket">${c.ticketId}</span>
        </div>
      </div>
      
      <div class="review-photos">
        <div class="review-photo-item">
          <span>Complaint Photo</span>
          <img src="${c.photo}" alt="Before" />
        </div>
        <div class="review-photo-item">
          <span>Resolution Photo</span>
          <img src="${c.resolutionPhoto || c.supervisorPhoto}" alt="After" />
        </div>
      </div>

      <div class="review-actions">
        ${!isReported ? `<button class="btn-report" data-ticket="${c.ticketId}">⚠️ Summon Supervisor</button>` : ''}
        <button class="btn-report-vendor" style="background: #7c3aed; color: #fff; border: none; padding: 9px 18px; border-radius: 8px; font-weight: 700; cursor: pointer;">👮 Report to Vendor</button>
        <button class="btn-clear" data-ticket="${c.ticketId}">✅ Clear & Resolve</button>
      </div>
    `;

    div.querySelector('.btn-clear').addEventListener('click', () => openReviewActionModal(c, 'clear'));
    div.querySelector('.btn-report-vendor').addEventListener('click', () => openReviewActionModal(c, 'forward'));
    if (!isReported) {
      div.querySelector('.btn-report').addEventListener('click', () => reportSupervisor(c));
    }

    return div;
  }

  async function reportSupervisor(c) {
    if (!confirm('Summon this supervisor? They will get a red alert to meet you at the office.')) return;
    await updateComplaint(c.ticketId, {
      status: 'reported_to_ao',
      timeline: [...(c.timeline || []), {
        event: 'AO Summoned Supervisor: Low quality work. Meeting required.',
        time: new Date().toISOString(), by: session.uid
      }]
    });
    render();
  }

  /* ─────────────────────────────────────────────
     AO REVIEW ACTION MODAL (FOR CLEAR/FORWARD)
  ───────────────────────────────────────────── */
  let activeReviewComplaint = null;
  let activeReviewType = null; // 'clear' or 'forward'

  function openReviewActionModal(c, type) {
    activeReviewComplaint = c;
    activeReviewType = type;
    const modal = document.getElementById('ao-review-modal');
    const title = document.getElementById('ao-review-title');
    const note = document.getElementById('ao-review-note-desc');
    const ticketLbl = document.getElementById('ao-review-ticket-label');
    const btnText = document.getElementById('ao-review-confirm-text');
    const err = document.getElementById('ao-review-err');

    const forwardBox = document.getElementById('ao-forward-box');
    const clearBox = document.getElementById('ao-clear-box');

    // Reset fields
    document.getElementById('ao-review-desc-vendor').value = '';
    document.getElementById('ao-clear-desc-vendor').value = '';
    document.getElementById('ao-clear-desc-student').value = '';
    ticketLbl.textContent = 'Ticket: ' + c.ticketId;
    err.style.display = 'none';

    if (type === 'forward') {
      title.textContent = 'Report to Vendor Manager';
      note.textContent = 'Explain the quality issue for the Vendor Manager to review.';
      btnText.textContent = '👮 Report to Vendor';
      forwardBox.style.display = 'block';
      clearBox.style.display = 'none';
    } else {
      title.textContent = 'Clear & Resolve Complaint';
      note.textContent = 'Explain the resolution. Your note for the student will be visible on their dashboard.';
      btnText.textContent = '✅ Clear & Resolve';
      forwardBox.style.display = 'none';
      clearBox.style.display = 'block';
    }

    modal.style.display = 'flex';
  }

  document.getElementById('ao-review-confirm').addEventListener('click', async () => {
    const err = document.getElementById('ao-review-err');
    let vendorNote = '';
    let studentNote = '';

    if (activeReviewType === 'forward') {
      vendorNote = document.getElementById('ao-review-desc-vendor').value.trim();
      if (!vendorNote) { err.style.display = 'block'; return; }
    } else {
      vendorNote = document.getElementById('ao-clear-desc-vendor').value.trim();
      studentNote = document.getElementById('ao-clear-desc-student').value.trim();
      if (!vendorNote || !studentNote) { err.style.display = 'block'; return; }
    }

    err.style.display = 'none';
    const btn = document.getElementById('ao-review-confirm');
    const spinner = document.getElementById('ao-review-spinner');
    const btnText = document.getElementById('ao-review-confirm-text');

    btn.disabled = true;
    spinner.style.display = 'inline-block';
    btnText.textContent = 'Processing...';

    if (activeReviewType === 'forward') {
      await escalateToVendor(activeReviewComplaint, vendorNote);
    } else {
      await clearComplaint(activeReviewComplaint, vendorNote, studentNote);
    }

    btn.disabled = false;
    spinner.style.display = 'none';
    document.getElementById('ao-review-modal').style.display = 'none';
  });

  async function escalateToVendor(c, note) {
    await updateComplaint(c.ticketId, {
      status: 'escalated_to_vendor',
      timeline: [...(c.timeline || []), {
        event: 'AO Reported to Vendor: Major quality dispute.',
        note: note,
        time: new Date().toISOString(), by: session.uid
      }]
    });
    alert('Case escalated to Vendor Portal.');
    render();
  }

  async function clearComplaint(c, vendorNote, studentNote) {
    // 1. Delete photos
    if (c.photo) await deletePhotoFromSupabase(c.photo);
    const resPhoto = c.resolutionPhoto || c.supervisorPhoto;
    if (resPhoto) await deletePhotoFromSupabase(resPhoto);

    // 2. Resolve in DB
    await updateComplaint(c.ticketId, {
      status: 'resolved',
      photo: null,
      supervisorPhoto: null,
      timeline: [...(c.timeline || []), {
        event: 'AO Cleared Review: Issue resolved and photos deleted.',
        vendorNote: vendorNote,
        note: studentNote, // 'note' is what student dashboard looks for
        time: new Date().toISOString(), by: session.uid
      }]
    });
    alert('Complaint successfully cleared and student notified.');
    render();
  }

  /* =========================================================
     LIVE COUNTDOWN TIMER
  ========================================================= */
  function startTimer(ticketId, deadlineISO, cardEl) {
    const timerEl = cardEl.querySelector('#ao-timer-' + ticketId);
    if (!timerEl) return;

    // Clear old interval for this ticket
    if (timerMap[ticketId]) clearInterval(timerMap[ticketId]);

    function tick() {
      if (!document.body.contains(timerEl)) {
        clearInterval(timerMap[ticketId]);
        return;
      }
      const ms = msUntil(deadlineISO);
      if (ms <= 0) {
        timerEl.textContent = '⚫ OVERDUE';
        timerEl.className = 'ao-timer-badge timer-overdue';
        return;
      }
      timerEl.textContent = '⏱ ' + formatCountdown(ms);
      if (ms < 5 * 60 * 1000) timerEl.className = 'ao-timer-badge timer-danger';
      else if (ms < 15 * 60 * 1000) timerEl.className = 'ao-timer-badge timer-warn';
      else timerEl.className = 'ao-timer-badge timer-ok';
    }

    tick();
    timerMap[ticketId] = setInterval(async () => {
      const ms = msUntil(deadlineISO);
      if (ms <= 0) {
        clearInterval(timerMap[ticketId]);
        await runEscalationEngine();
        await render();
        return;
      }
      tick();
    }, 1000);
  }

  /* =========================================================
     RESOLVE MODAL
  ========================================================= */
  let activeTicket = null;
  let photoData = null;

  const modal = document.getElementById('ao-resolve-modal');
  const photoInput = document.getElementById('ao-photo-input');
  const previewWrap = document.getElementById('ao-preview-wrap');
  const previewImg = document.getElementById('ao-preview-img');
  const removeBtn = document.getElementById('ao-remove-btn');
  const cancelBtn = document.getElementById('ao-modal-cancel');
  const confirmBtn = document.getElementById('ao-modal-confirm');
  const ticketLbl = document.getElementById('ao-modal-ticket-label');
  const photoErr = document.getElementById('ao-photo-err');
  const confirmTxt = document.getElementById('ao-confirm-text');
  const spinner = document.getElementById('ao-confirm-spinner');

  function openModal(ticketId) {
    activeTicket = ticketId;
    photoData = null;
    previewWrap.style.display = 'none';
    document.getElementById('ao-upload-zone').style.display = '';
    photoErr.style.display = 'none';
    ticketLbl.textContent = 'Ticket: ' + ticketId;
    confirmBtn.disabled = false;
    confirmTxt.textContent = '✅ Confirm Resolved';
    spinner.style.display = 'none';
    modal.style.display = 'flex';
  }

  cancelBtn.addEventListener('click', () => { modal.style.display = 'none'; });
  modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

  photoInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      photoData = ev.target.result;
      previewImg.src = photoData;
      previewWrap.style.display = '';
      document.getElementById('ao-upload-zone').style.display = 'none';
      photoErr.style.display = 'none';
    };
    reader.readAsDataURL(file);
  });

  removeBtn.addEventListener('click', () => {
    photoData = null;
    previewImg.src = '';
    previewWrap.style.display = 'none';
    document.getElementById('ao-upload-zone').style.display = '';
    photoInput.value = '';
  });

  confirmBtn.addEventListener('click', async () => {
    if (!photoData) { photoErr.style.display = 'block'; return; }
    confirmBtn.disabled = true;
    confirmTxt.textContent = 'Uploading Photo…';
    spinner.style.display = 'inline-block';

    // 1. Upload to Supabase Storage
    let finalPhotoURL = photoData;
    if (window.supabaseClient) {
      finalPhotoURL = await uploadPhotoToSupabase(photoData, `${activeTicket}_ao_res.jpg`);
    }

    confirmTxt.textContent = 'Saving…';

    const all = await getComplaints();
    const c = all.find(x => x.ticketId === activeTicket);
    const now = new Date();

    await updateComplaint(activeTicket, {
      status: 'ao_resolved',
      aoResolvedAt: now.toISOString(),
      aoResolutionPhoto: finalPhotoURL,
      timeline: [...(c?.timeline || []), {
        event: 'AO Office Marked Resolved',
        time: now.toISOString(), by: session.uid
      }]
    });

    modal.style.display = 'none';
    await render();
  });

  /* ── Initial render + Refresh (10s) ── */
  render();
  setInterval(async () => { await runEscalationEngine(); await render(); }, 10000);

})();
