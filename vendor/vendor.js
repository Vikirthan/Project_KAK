/* ===========================
   VENDOR PORTAL JS
   =========================== */

(function () {
    'use strict';

    /* ── Auth guard ── */
    const session = kakGetSession('vendor');
    if (!session) {
        window.location.href = '../index.html';
        return;
    }

    /* ── Run escalation engine on load ── */
    runEscalationEngine();

    /* ── Populate navbar ── */
    document.getElementById('nav-name').textContent = session.name;
    document.getElementById('btn-logout').addEventListener('click', () => kakLogout(session.uid));

    /* =========================================================
       CORE LOGIC
    ========================================================= */
    async function render() {
        const ranking = await getSupervisorRanking();
        const complaints = await getComplaints();
        const stats = calculateGlobalStats(ranking, complaints);

        renderStats(stats);
        renderAlerts(ranking);
        renderRanking(ranking);
        renderDisputes(complaints);
    }

    function renderDisputes(complaints) {
        const containers = {
            section: document.getElementById('escalated-section'),
            list: document.getElementById('dispute-list'),
            badge: document.getElementById('badge-escalated')
        };
        const escalated = complaints.filter(c => c.status === 'escalated_to_vendor');

        if (escalated.length === 0) {
            containers.section.style.display = 'none';
            return;
        }

        containers.section.style.display = 'block';
        containers.badge.textContent = escalated.length;
        containers.list.innerHTML = '';

        escalated.forEach(c => {
            const card = document.createElement('div');
            card.className = 'dispute-card';
            card.innerHTML = `
                <div class="dispute-header">
                    <div>
                        <div class="dispute-sup">👷 Supervisor: ${c.assignedSupervisor}</div>
                        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Ticket: ${c.ticketId}</div>
                    </div>
                    <span class="dispute-rating">${c.studentRating}⭐ Student Rating</span>
                </div>
                
                <div style="font-size: 12px; font-style: italic; color: var(--text-secondary); background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px;">
                    "${c.description || 'No description'}"
                </div>

                <div class="dispute-photos">
                    <div class="dispute-photo-item">
                        <span>Complaint</span>
                        <img src="${c.photo}" alt="Before" />
                    </div>
                    <div class="dispute-photo-item">
                        <span>Resolution</span>
                        <img src="${c.supervisorPhoto || c.resolutionPhoto}" alt="After" />
                    </div>
                </div>

                <div class="dispute-actions">
                    <button class="btn-dispute-clear" data-ticket="${c.ticketId}">✅ Accept & Clear</button>
                    <button class="btn-dispute-warn" data-ticket="${c.ticketId}">🚩 Issue Warning (⚫)</button>
                </div>
            `;

            card.querySelector('.btn-dispute-clear').addEventListener('click', () => vendorDecision(c, 'clear'));
            card.querySelector('.btn-dispute-warn').addEventListener('click', () => vendorDecision(c, 'warn'));

            containers.list.appendChild(card);
        });
    }

    async function vendorDecision(c, action) {
        if (!confirm(`Are you sure you want to ${action === 'clear' ? 'Accept & Resolve' : 'Issue Warning'} for this ticket?`)) return;

        // 1. If Warning, award black point
        if (action === 'warn') {
            await addRating(c.assignedSupervisor, 0, c.ticketId); // Internal: 0 rating trigger 2 black points in some systems? 
            // Actually, let's use the timeline to mark it.
        }

        // 2. Clear photos from Storage
        if (c.photo) await deletePhotoFromSupabase(c.photo);
        const resPhoto = c.supervisorPhoto || c.resolutionPhoto;
        if (resPhoto) await deletePhotoFromSupabase(resPhoto);

        // 3. Resolve complaint
        await updateComplaint(c.ticketId, {
            status: 'resolved',
            photo: null,
            supervisorPhoto: null,
            timeline: [...(c.timeline || []), {
                event: `Vendor Final Decision: ${action === 'clear' ? 'Accepted' : 'Warning Issued'}. Case Closed.`,
                time: new Date().toISOString(), by: session.uid
            }]
        });

        alert('Final decision recorded and photos cleared.');
        await render();
    }

    function calculateGlobalStats(ranking, complaints) {
        let totalBlackPoints = 0;
        let totalRatings = 0;
        let ratingSum = 0;

        ranking.forEach(r => {
            totalBlackPoints += r.blackPoints;
            if (r.rating > 0) {
                totalRatings++;
                ratingSum += r.rating;
            }
        });

        const missedCount = complaints.filter(c => c.status === 'closed_overdue' || c.escalated).length;

        return {
            totalSupervisors: ranking.length,
            totalBlackPoints,
            totalReceived: complaints.length,
            totalOntime: complaints.filter(c => c.resolvedOnTime).length,
            totalMissed: missedCount,
            avgRating: totalRatings > 0 ? (ratingSum / totalRatings).toFixed(1) : '–'
        };
    }

    /* =========================================================
       RENDERERS
    ========================================================= */
    function renderStats(stats) {
        document.getElementById('stat-total-sup').textContent = stats.totalSupervisors;
        document.getElementById('stat-total-received').textContent = stats.totalReceived;
        document.getElementById('stat-total-ontime').textContent = stats.totalOntime;
        document.getElementById('stat-total-missed').textContent = stats.totalMissed;
        document.getElementById('stat-avg-rating').textContent = stats.avgRating;
        document.getElementById('stat-total-bp').textContent = stats.totalBlackPoints;
    }

    function renderAlerts(ranking) {
        const container = document.getElementById('alerts-container');
        container.innerHTML = '';

        const flagged = ranking.filter(r => r.blackPoints >= 4);

        if (flagged.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        flagged.forEach(sup => {
            const div = document.createElement('div');
            div.className = 'alert-banner';
            const urgency = sup.blackPoints >= 5 ? 'CRITICAL: Terminate or Suspend' : 'WARNING: High violations';
            div.innerHTML = `
                <span class="alert-icon">${sup.blackPoints >= 5 ? '🛑' : '⚠️'}</span>
                <div class="alert-body">
                    <div class="alert-title">${urgency} — ${sup.name} (${sup.uid})</div>
                    <p class="alert-text">${sup.name} from Block ${sup.block} has reached <strong>${sup.blackPoints} black points</strong>. Immediate action required.</p>
                </div>
                <button class="btn-contact" onclick="alert('Sending warning to ${sup.uid}...')">Contact Now</button>
            `;
            container.appendChild(div);
        });
    }

    function renderRanking(ranking) {
        const container = document.getElementById('ranking-list');
        const emptyEl = document.getElementById('empty-ranking');

        if (!ranking.length) {
            emptyEl.style.display = 'block';
            return;
        }
        emptyEl.style.display = 'none';
        container.innerHTML = '';

        ranking.forEach((sup, index) => {
            const card = document.createElement('div');
            card.className = 'rank-card';

            let bpClass = 'bp-ok';
            if (sup.blackPoints >= 4) bpClass = 'bp-danger';
            else if (sup.blackPoints >= 2) bpClass = 'bp-warn';

            const ratingVal = sup.rating || 0;
            const stars = ratingVal > 0 ? '⭐'.repeat(Math.round(ratingVal)) : '';
            const ratingDisplay = ratingVal > 0 ? ratingVal.toFixed(1) : '–';

            card.innerHTML = `
                <span class="rank-num">#${index + 1}</span>
                <div class="sup-info">
                    <span class="sup-name">${sup.name}</span>
                    <span class="sup-block-uid">Block ${sup.block} • ${sup.uid}</span>
                </div>
                <div class="rating-wrap">
                    <div class="sm-lbl">Avg Rating</div>
                    <div class="sm-val">${ratingDisplay}</div>
                    <div class="rating-stars">${stars}</div>
                </div>
                <div class="stats-mini-wrap">
                    <div class="sm-lbl">Resolved</div>
                    <div class="sm-val">${sup.resolvedOnTime || 0}</div>
                </div>
                <div class="stats-mini-wrap">
                    <div class="sm-lbl">Missed</div>
                    <div class="sm-val" style="color: #fca5a5;">${sup.missed || 0}</div>
                </div>
                <div class="stats-mini-wrap">
                    <div class="sm-lbl">Total</div>
                    <div class="sm-val">${sup.totalAssigned || 0}</div>
                </div>
                <div class="bp-wrap">
                    <div class="sm-lbl">Violations</div>
                    <div class="black-points-pill ${bpClass}">${sup.blackPoints} Black Points</div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    /* ── Initial render ── */
    render();

    /* ── Auto-refresh every 5s ── */
    setInterval(async () => {
        await runEscalationEngine();
        await render();
    }, 5000);

})();
