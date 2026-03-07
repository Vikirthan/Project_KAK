/* ===========================
   SUPERVISOR PORTAL JS
   supervisor.js
   =========================== */

(function () {
  'use strict';

  /* ── Auth guard ── */
  const session = kakGetSession('supervisor');
  if (!session) {
    window.location.href = '../index.html';
    return;
  }

  /* ── Run escalation engine on load ── */
  runEscalationEngine();

  // Request notification permission (simulated push)
  if (Notification.permission !== 'granted') {
    Notification.requestPermission();
  }

  document.getElementById('nav-name').textContent = session.name;
  document.getElementById('nav-uid').textContent = 'UID: ' + session.uid;
  document.getElementById('nav-block-badge').textContent = 'Block ' + (session.block || '–');
  document.getElementById('sup-title').textContent = 'Block ' + (session.block || '–') + ' Dashboard';
  document.getElementById('btn-logout').addEventListener('click', () => kakLogout(session.uid));

  /* ── Timer intervals store ── */
  const timerMap = {}; // ticketId → intervalId
  let lastRenderHash = '';

  /* ─────────────────────────────────────────────
     RENDER ALL SECTIONS
  ───────────────────────────────────────────── */
  async function render() {
    const all = await getComplaintsForSupervisor(session.uid);

    // ── Pre-render check to avoid flickering ──
    if (!KAK.hasListChanged(lastRenderHash, all)) return;
    lastRenderHash = KAK.generateListHash(all);

    const stat = await getSupStat(session.uid);

    const unaccepted = all.filter(c => c.status === 'pending_acceptance');
    const active = all.filter(c => c.status === 'pending_supervisor');
    const approval = all.filter(c => c.status === 'pending_approval');
    const aoAlerts = all.filter(c => c.status === 'pending_ao' || c.status === 'closed_overdue');
    const resolved = all.filter(c => ['resolved', 'closed', 'pending_ao_review', 'reported_to_ao'].includes(c.status));

    /* Stats */
    document.getElementById('stat-total').textContent = all.length;
    document.getElementById('stat-resolved').textContent = all.filter(c => c.resolvedOnTime).length;
    document.getElementById('stat-missed').textContent = aoAlerts.length;
    document.getElementById('stat-black').textContent = (stat.blackPoints || 0) + ' ⚫';
    const avgR = stat.avgRating || 0;
    document.getElementById('stat-rating').textContent = avgR > 0 ? '⭐ ' + avgR : '–';

    /* Flagged warning */
    document.getElementById('flagged-alert').style.display = (stat.blackPoints || 0) >= 5 ? 'flex' : 'none';

    /* Auto-Accept Alert */
    const autoAcceptedComplaints = active.filter(c => c.autoAccepted);
    const hasAutoAccepted = autoAcceptedComplaints.length > 0;
    const aaAlert = document.getElementById('auto-accept-alert');
    if (aaAlert) {
      aaAlert.style.display = hasAutoAccepted ? 'flex' : 'none';
      if (hasAutoAccepted) {
        aaAlert.classList.add('blink-alert');

        // Trigger simulated push notification
        if (Notification.permission === 'granted' && !window.lastNotifiedAA) {
          new Notification("🚨 AUTO-ACCEPTED TASK", {
            body: "You missed the 10-minute acceptance window. This task has been auto-accepted and the resolution timer has started. Resolve it NOW!",
            icon: "../assets/logo.png"
          });
          window.lastNotifiedAA = true; // Simple throttle
        }
      }
    }

    /* AO Summon Alert */
    const summoned = all.some(c => c.status === 'reported_to_ao');
    document.getElementById('summoned-alert').style.display = summoned ? 'flex' : 'none';

    /* Badges */
    document.getElementById('badge-acceptance').textContent = unaccepted.length;
    document.getElementById('badge-active').textContent = active.length;
    document.getElementById('badge-approval').textContent = approval.length;
    document.getElementById('badge-ao').textContent = aoAlerts.length;
    document.getElementById('badge-resolved').textContent = resolved.length;

    /* Lists */
    renderList('acceptance-list', 'empty-acceptance', unaccepted, renderAcceptanceCard);
    renderList('active-list', 'empty-active', active, renderActiveCard);
    renderList('approval-list', 'empty-approval', approval, renderApprovalCard);
    renderList('ao-list', 'empty-ao', aoAlerts, renderAOCard);
    renderList('resolved-list', 'empty-resolved', resolved, renderResolvedCard);
  }

  /* ─────────────────────────────────────────────
     ACCEPTANCE CARD (pending_acceptance)
  ───────────────────────────────────────────── */
  function renderAcceptanceCard(c) {
    const div = document.createElement('div');
    div.className = 'sup-card card-new';
    div.id = 'card-' + c.ticketId;

    div.innerHTML = `
      <div class="card-top">
        <div class="card-left">
          <div class="card-issue">${c.issueType}</div>
          <div class="card-meta">
            <span>📍 ${c.block}</span>
            <span>⏱️ Submitted: ${formatTime(new Date(c.submittedAt))}</span>
          </div>
        </div>
        <div class="card-right">
          <span class="timer-badge timer-warn" id="timer-${c.ticketId}">⏱ --:--</span>
          <span class="status-pill pill-new">🆕 New Request</span>
          <span class="ticket-chip">${c.ticketId}</span>
        </div>
      </div>
      <div class="card-actions">
        <button class="btn-accept" data-ticket="${c.ticketId}">⚡ Accept & Start 30m Timer</button>
      </div>
    `;

    /* Live countdown (Acceptance 10m) */
    startTimer(c.ticketId, c.acceptanceDeadline, div);

    /* Accept logic */
    div.querySelector('.btn-accept').addEventListener('click', () => acceptComplaint(c));

    return div;
  }

  async function acceptComplaint(c) {
    const now = new Date();
    const patch = {
      status: 'pending_supervisor',
      acceptedAt: now.toISOString(),
      supervisorDeadline: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      timeline: [...(c.timeline || []), {
        event: 'Complaint Accepted by Supervisor - 30m Resolution Timer Started',
        time: now.toISOString(), by: session.uid
      }]
    };
    await updateComplaint(c.ticketId, patch);
    render();
  }

  function renderList(listId, emptyId, items, cardFn) {
    const container = document.getElementById(listId);
    const emptyEl = document.getElementById(emptyId);

    // Clear existing cards
    Array.from(container.children).forEach(el => {
      if (!el.classList.contains('empty-state')) el.remove();
    });

    if (!items.length) {
      emptyEl.style.display = '';
      return;
    }
    emptyEl.style.display = 'none';
    items.forEach(c => container.appendChild(cardFn(c)));
  }

  /* ─────────────────────────────────────────────
     ACTIVE CARD (pending_supervisor)
  ───────────────────────────────────────────── */
  function renderActiveCard(c) {
    const div = document.createElement('div');
    div.className = 'sup-card' + (c.autoAccepted ? ' card-auto-accepted' : '');
    div.id = 'card-' + c.ticketId;

    div.innerHTML = `
      <div class="card-top">
        <div class="card-left">
          <div class="card-issue">${c.issueType}</div>
          <div class="card-meta">
            <span>📍 ${c.block}</span>
            <span>🎓 ${c.studentName}</span>
            <span>📞 ${c.phone}</span>
          </div>
        </div>
        <div class="card-right">
          <span class="timer-badge timer-ok" id="timer-${c.ticketId}">⏱ --:--</span>
          ${c.autoAccepted ? '<span class="status-pill pill-urgent blink-alert">🔔 AUTO-ACCEPTED</span>' : '<span class="status-pill pill-pending">🔴 Active</span>'}
          <span class="ticket-chip">${c.ticketId}</span>
        </div>
      </div>
      ${c.description ? `<div class="card-desc">"${c.description}"</div>` : ''}
      ${c.photo ? `<div class="card-photo-wrap"><img class="card-photo-thumb" src="${c.photo}" alt="Student photo" /></div>` : ''}
      <div class="card-actions">
        <button class="btn-resolve" data-ticket="${c.ticketId}">✅ Mark as Resolved</button>
      </div>
    `;

    /* Live countdown */
    startTimer(c.ticketId, c.supervisorDeadline, div);

    /* Resolve button */
    div.querySelector('.btn-resolve').addEventListener('click', () => openResolveModal(c.ticketId));

    return div;
  }

  /* ─────────────────────────────────────────────
     AWAITING APPROVAL CARD
  ───────────────────────────────────────────── */
  function renderApprovalCard(c) {
    const div = document.createElement('div');
    div.className = 'sup-card card-approval';

    div.innerHTML = `
      <div class="card-top">
        <div class="card-left">
          <div class="card-issue">${c.issueType}</div>
          <div class="card-meta">
            <span>📍 ${c.block}</span>
            <span>🎓 ${c.studentName}</span>
            <span>Resolved at ${formatDateTime(new Date(c.resolvedAt))}</span>
          </div>
        </div>
        <div class="card-right">
          <span class="status-pill pill-approval">⏳ Awaiting Student</span>
          <span class="ticket-chip">${c.ticketId}</span>
        </div>
      </div>
      ${c.resolutionPhoto ? `
        <div class="resolution-photo-wrap">
          <span class="resolution-label">📸 Your Resolution Photo</span>
          <img src="${c.resolutionPhoto}" alt="Resolution" />
        </div>` : ''}
    `;

    return div;
  }

  /* ─────────────────────────────────────────────
     AO ALERT CARD
  ───────────────────────────────────────────── */
  function renderAOCard(c) {
    const div = document.createElement('div');
    div.className = 'sup-card card-ao';

    const aoTimerHTML = c.status === 'pending_ao' && c.aoDeadline
      ? `<span class="timer-badge timer-danger" id="ao-timer-${c.ticketId}">⏱ --:--</span>` : '';

    div.innerHTML = `
      <div class="card-top">
        <div class="card-left">
          <div class="card-issue">🚨 ${c.issueType}</div>
          <div class="card-meta">
            <span>📍 ${c.block}</span>
            <span>🎓 ${c.studentName}</span>
            <span>Escalated at ${c.aoAlertAt ? formatDateTime(new Date(c.aoAlertAt)) : '–'}</span>
          </div>
        </div>
        <div class="card-right">
          ${aoTimerHTML}
          <span class="status-pill ${c.status === 'closed_overdue' ? 'pill-overdue' : 'pill-ao'}">
            ${c.status === 'closed_overdue' ? '⚫ Black Point' : '🏢 AO Handling'}
          </span>
          <span class="ticket-chip">${c.ticketId}</span>
        </div>
      </div>
      ${c.description ? `<div class="card-desc">"${c.description}"</div>` : ''}
    `;

    if (c.status === 'pending_ao' && c.aoDeadline) {
      startTimer(c.ticketId, c.aoDeadline, div, 'ao-timer-');
    }

    return div;
  }

  /* ─────────────────────────────────────────────
     RESOLVED CARD
  ───────────────────────────────────────────── */
  function renderResolvedCard(c) {
    const div = document.createElement('div');
    div.className = 'sup-card card-resolved';
    const stars = c.studentRating ? '⭐'.repeat(c.studentRating) : null;

    div.innerHTML = `
      <div class="card-top">
        <div class="card-left">
          <div class="card-issue">✅ ${c.issueType}</div>
          <div class="card-meta">
            <span>📍 ${c.block}</span>
            <span>🎓 ${c.studentName}</span>
            <span>Resolved at ${formatDateTime(new Date(c.resolvedAt || c.submittedAt))}</span>
          </div>
        </div>
        <div class="card-right">
          <span class="status-pill pill-resolved">✅ Resolved</span>
          <span class="ticket-chip">${c.ticketId}</span>
        </div>
      </div>
      ${stars ? `<div class="star-row">${stars}<span class="rating-num">${c.studentRating}/5 by student</span></div>` : '<div class="card-desc">Rating pending from student.</div>'}
      ${c.resolutionPhoto ? `
        <div class="resolution-photo-wrap">
          <span class="resolution-label">📸 Resolution Photo</span>
          <img src="${c.resolutionPhoto}" alt="Resolution" />
        </div>` : ''}
    `;
    return div;
  }

  /* ─────────────────────────────────────────────
     LIVE COUNTDOWN TIMER
  ───────────────────────────────────────────── */
  function startTimer(ticketId, deadlineISO, cardEl, prefix = 'timer-') {
    const timerEl = cardEl.querySelector('#' + prefix + ticketId);
    if (!timerEl) return;

    // Clear any existing interval for THIS ticket before starting a new one
    if (timerMap[ticketId]) clearInterval(timerMap[ticketId]);

    function tick() {
      // If the element is no longer in the body, stop the interval
      if (!document.contains(timerEl)) {
        clearInterval(timerMap[ticketId]);
        delete timerMap[ticketId];
        return;
      }

      const ms = msUntil(deadlineISO);
      if (ms <= 0) {
        timerEl.textContent = '⏱ OVERDUE';
        timerEl.className = 'timer-badge timer-overdue';
        clearInterval(timerMap[ticketId]);
        return;
      }

      timerEl.textContent = '⏱ ' + formatCountdown(ms);
      if (ms < 5 * 60 * 1000) timerEl.className = 'timer-badge timer-danger';
      else if (ms < 15 * 60 * 1000) timerEl.className = 'timer-badge timer-warn';
      else timerEl.className = 'timer-badge timer-ok';
    }

    // Initial delay to allow card to be appended to body
    setTimeout(tick, 100);

    timerMap[ticketId] = setInterval(tick, 1000);
  }

  /* ─────────────────────────────────────────────
     RESOLVE MODAL
  ───────────────────────────────────────────── */
  let activeResolveTicket = null;
  let resolutionPhotoData = null;

  const modal = document.getElementById('resolve-modal');
  const photoInput = document.getElementById('sup-photo-input');
  const previewWrap = document.getElementById('sup-preview-wrap');
  const previewImg = document.getElementById('sup-preview-img');
  const removeBtn = document.getElementById('sup-remove-btn');
  const modalCancel = document.getElementById('modal-cancel');
  const modalConfirm = document.getElementById('modal-confirm');
  const modalLabel = document.getElementById('modal-ticket-label');
  const modalPhotoErr = document.getElementById('modal-photo-err');
  const modalText = document.getElementById('modal-confirm-text');
  const modalSpinner = document.getElementById('modal-spinner');

  function openResolveModal(ticketId) {
    activeResolveTicket = ticketId;
    resolutionPhotoData = null;
    previewWrap.style.display = 'none';
    document.getElementById('sup-upload-zone').style.display = '';
    modalPhotoErr.style.display = 'none';
    modalLabel.textContent = 'Ticket: ' + ticketId;
    modalConfirm.disabled = false;
    modalText.textContent = 'Confirm Resolved';
    modalSpinner.style.display = 'none';
    modal.style.display = 'flex';
  }

  modalCancel.addEventListener('click', () => { modal.style.display = 'none'; });
  modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

  photoInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      resolutionPhotoData = ev.target.result;
      previewImg.src = resolutionPhotoData;
      previewWrap.style.display = '';
      document.getElementById('sup-upload-zone').style.display = 'none';
      modalPhotoErr.style.display = 'none';
    };
    reader.readAsDataURL(file);
  });

  removeBtn.addEventListener('click', () => {
    resolutionPhotoData = null;
    previewImg.src = '';
    previewWrap.style.display = 'none';
    document.getElementById('sup-upload-zone').style.display = '';
    photoInput.value = '';
  });

  modalConfirm.addEventListener('click', async () => {
    if (!resolutionPhotoData) {
      modalPhotoErr.style.display = 'block';
      return;
    }
    modalConfirm.disabled = true;
    modalText.textContent = 'Uploading Photo…';
    modalSpinner.style.display = 'inline-block';

    try {
      // 1. Upload to Supabase Storage using the unified client
      let finalPhotoURL = resolutionPhotoData;
      if (window.supabaseClient) {
        console.log('[SUP-DEBUG] Uploading resolution photo for:', activeResolveTicket);
        finalPhotoURL = await uploadPhotoToSupabase(resolutionPhotoData, `${activeResolveTicket}_resolution.jpg`);

        if (!finalPhotoURL || finalPhotoURL === resolutionPhotoData) {
          throw new Error("Upload returned invalid URL");
        }
      }

      modalText.textContent = 'Saving…';

      const now = new Date();
      const all = await getComplaints();
      const c = all.find(x => x.ticketId === activeResolveTicket);
      const onTime = c && msUntil(c.supervisorDeadline) > 0;

      await updateComplaint(activeResolveTicket, {
        status: 'pending_approval',
        resolvedAt: now.toISOString(),
        resolutionPhoto: finalPhotoURL,
        resolvedOnTime: onTime,
        timeline: [...(c.timeline || []), {
          event: 'Supervisor Marked Resolved — Pending student review',
          time: now.toISOString(), by: session.uid
        }]
      });

      // Update live stats in MATRIX
      await recordResolutionStats(session.uid, onTime);

      modal.style.display = 'none';
      await render();
    } catch (err) {
      console.error('[SUP-ERROR] Resolution failed:', err);
      modalText.textContent = '❌ Upload Failed';
      modalSpinner.style.display = 'none';

      alert('Photo update failed. This could be due to a database connection timeout. Please wait 5 seconds and try again.');

      setTimeout(() => {
        modalConfirm.disabled = false;
        modalText.textContent = '✅ Confirm Resolved';
      }, 5000);
    }
  });


  /* ─────────────────────────────────────────────
     INITIAL RENDER + AUTO-REFRESH EVERY 10s
  ───────────────────────────────────────────── */
  render();
  setInterval(async () => { await runEscalationEngine(); await render(); }, 10000);

})();
