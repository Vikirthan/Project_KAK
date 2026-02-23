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

  /* ── Navbar ── */
  document.getElementById('nav-name').textContent = session.name;
  document.getElementById('btn-logout').addEventListener('click', () => kakLogout(session.uid));

  /* ── Timer store ── */
  const timerMap = {};

  /* =========================================================
     RENDER
  ========================================================= */
  async function render() {
    let all = await getComplaints();

    // ── Filter by AO's assigned block ──
    if (session.block) {
      all = all.filter(c => c.block === session.block);
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
    div.innerHTML = `
      <div class="ao-card-top">
        <div class="ao-card-left">
          <div class="ao-issue">✅ ${c.issueType}</div>
          <div class="ao-meta">
            <span>📍 Block ${c.block}</span>
            <span>🎓 ${c.studentName}</span>
            <span>Resolved: ${c.aoResolvedAt ? formatDateTime(new Date(c.aoResolvedAt)) : '–'}</span>
          </div>
        </div>
        <div class="ao-card-right">
          <span class="ao-status-pill pill-resolved">✅ AO Resolved</span>
          <span class="ao-ticket">${c.ticketId}</span>
        </div>
      </div>
      ${c.aoResolutionPhoto ? `<div class="ao-photo-wrap"><img src="${c.aoResolutionPhoto}" alt="AO resolution" /><span>📸 AO resolution photo</span></div>` : ''}
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
     QUALITY REVIEW CARD (< 4 STARS)
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

    div.querySelector('.btn-clear').addEventListener('click', () => clearComplaint(c));
    div.querySelector('.btn-report-vendor').addEventListener('click', () => escalateToVendor(c));
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

  async function escalateToVendor(c) {
    if (!confirm('Report this to the Vendor? Photos will be kept for their final review.')) return;
    await updateComplaint(c.ticketId, {
      status: 'escalated_to_vendor',
      timeline: [...(c.timeline || []), {
        event: 'AO Reported to Vendor: Major quality dispute.',
        time: new Date().toISOString(), by: session.uid
      }]
    });
    alert('Case escalated to Vendor Portal.');
    render();
  }

  async function clearComplaint(c) {
    if (!confirm('Clear this complaint? Both photos will be deleted from the server.')) return;

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
        event: 'AO Cleared Review: Photos deleted from server.',
        time: new Date().toISOString(), by: session.uid
      }]
    });
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
    if (window.kakSupabase) {
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

  /* ── Initial render + Fast Refresh (5s) ── */
  render();
  setInterval(async () => { await runEscalationEngine(); await render(); }, 5000);

})();
