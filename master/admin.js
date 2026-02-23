/**
 * KAK MASTER ADMIN JS
 * admin.js
 * Enhanced with specific delete and password-protected wipe
 */

(function () {
    'use strict';

    // Auth Guard
    const session = kakGetSession('admin');
    if (!session) {
        window.location.href = '../index.html';
        return;
    }

    document.getElementById('nav-name').textContent = session.name;
    document.getElementById('btn-logout').addEventListener('click', () => kakLogout(session.uid));

    // UI Elements
    const complaintsBody = document.getElementById('complaints-body');
    const supervisorsBody = document.getElementById('supervisors-body');
    const searchInput = document.getElementById('search-data');
    const wipeModal = document.getElementById('wipe-modal');

    let allComplaints = [];

    async function init() {
        await loadData();
        setupEventListeners();
    }

    async function loadData() {
        const dc = window.supabaseClient;
        if (!dc) {
            console.error("Supabase client not found.");
            return;
        }

        // 1. Fetch Complaints
        const { data: complaints, error: cErr } = await dc
            .from('complaints')
            .select('*')
            .order('submitted_at', { ascending: false });

        if (!cErr) {
            allComplaints = complaints;
            renderComplaints(allComplaints);
            updateStats(allComplaints);
        } else {
            console.error("Fetch complaints error:", cErr);
        }

        // 2. Fetch Supervisors
        const { data: sups, error: sErr } = await dc
            .from('supervisor_stats')
            .select('*');

        if (!sErr && sups) {
            renderSupervisors(sups);
            const totalSupEl = document.getElementById('total-supervisors');
            if (totalSupEl) totalSupEl.textContent = sups.length;
        }
    }

    function renderComplaints(list) {
        complaintsBody.innerHTML = '';
        list.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><code style="color:var(--primary)">${c.ticket_id}</code></td>
                <td>Block ${c.block}</td>
                <td>${c.issue_type}</td>
                <td><span class="status-tag" style="background:rgba(255,255,255,0.05)">${c.status.replace(/_/g, ' ')}</span></td>
                <td>${c.assigned_supervisor || '—'}</td>
                <td>${c.student_rating ? c.student_rating + ' ⭐' : '—'}</td>
                <td>${new Date(c.submitted_at).toLocaleDateString()}</td>
                <td><button class="btn-item-delete" data-id="${c.id}" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:18px;" title="Delete Ticket">🗑️</button></td>
            `;
            complaintsBody.appendChild(tr);
        });

        // Add delete listeners
        complaintsBody.querySelectorAll('.btn-item-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if (confirm('Delete this ticket permanently from database?')) {
                    const dc = window.supabaseClient;
                    const { error } = await dc.from('complaints').delete().eq('id', id);
                    if (error) alert('Delete failed: ' + error.message);
                    else loadData();
                }
            });
        });
    }

    function renderSupervisors(list) {
        if (!supervisorsBody) return;
        supervisorsBody.innerHTML = '';
        list.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><b>${s.supervisor_uid}</b></td>
                <td>${s.total_resolved}</td>
                <td>${s.total_missed}</td>
                <td>${s.black_points} ⚫</td>
                <td>${s.avg_rating ? s.avg_rating + ' ⭐' : '—'}</td>
                <td><button class="btn-sup-reset" data-uid="${s.supervisor_uid}" style="background:none; border:none; color:#f59e0b; cursor:pointer;" title="Reset Stats">🔄</button></td>
            `;
            supervisorsBody.appendChild(tr);
        });

        supervisorsBody.querySelectorAll('.btn-sup-reset').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const uid = e.currentTarget.getAttribute('data-uid');
                if (confirm(`Reset all stats for ${uid}? This will set ratings and points to zero.`)) {
                    const dc = window.supabaseClient;
                    await dc.from('supervisor_stats').update({
                        total_resolved: 0, total_assigned: 0, total_missed: 0,
                        total_escalated: 0, resolved_on_time: 0, black_points: 0,
                        avg_rating: 0, black_point_tickets: []
                    }).eq('supervisor_uid', uid);
                    loadData();
                }
            });
        });
    }

    function updateStats(list) {
        const tcEl = document.getElementById('total-complaints');
        const acEl = document.getElementById('active-complaints');
        if (tcEl) tcEl.textContent = list.length;
        if (acEl) acEl.textContent = list.filter(c => !['resolved', 'closed', 'ao_resolved'].includes(c.status)).length;
    }

    function setupEventListeners() {
        // Search
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allComplaints.filter(c =>
                c.ticket_id.toLowerCase().includes(term) ||
                c.block.toString().includes(term) ||
                c.issue_type.toLowerCase().includes(term) ||
                (c.assigned_supervisor && c.assigned_supervisor.toLowerCase().includes(term))
            );
            renderComplaints(filtered);
        });

        // Refresh
        document.getElementById('btn-refresh').addEventListener('click', loadData);

        // Wipe Logic
        const wipePass = document.getElementById('wipe-password');
        const wipeErr = document.getElementById('wipe-error');

        document.getElementById('btn-wipe').addEventListener('click', () => {
            if (wipePass) wipePass.value = '';
            if (wipeErr) wipeErr.style.display = 'none';
            wipeModal.style.display = 'flex';
        });

        document.getElementById('cancel-wipe').addEventListener('click', () => {
            wipeModal.style.display = 'none';
        });

        document.getElementById('confirm-wipe').addEventListener('click', async () => {
            if (wipePass.value !== 'Viki') {
                wipeErr.style.display = 'block';
                return;
            }

            const btn = document.getElementById('confirm-wipe');
            btn.disabled = true;
            btn.textContent = 'WIPING...';

            const dc = window.supabaseClient;

            try {
                // 1. Delete all complaints - Filter on a string field to avoid UUID type errors
                const { error: cErr } = await dc.from('complaints').delete().neq('ticket_id', '_none_');
                if (cErr) throw cErr;

                // 2. Reset Statistics for all supervisors - Filter on supervisor_uid string
                const { error: sErr } = await dc.from('supervisor_stats').update({
                    total_resolved: 0,
                    total_assigned: 0,
                    total_missed: 0,
                    total_escalated: 0,
                    resolved_on_time: 0,
                    black_points: 0,
                    avg_rating: 0,
                    black_point_tickets: []
                }).neq('supervisor_uid', '_none_');
                if (sErr) throw sErr;

                alert('NUCLEAR WIPE SUCCESSFUL. DATABASE IS RESET.');
                window.location.reload();
            } catch (err) {
                console.error('NUCLEAR WIPE FAILED:', err);
                alert('WIPE FAILED: ' + err.message);
                btn.disabled = false;
                btn.textContent = 'CONFIRM WIPE';
            }
        });
    }

    init();

})();
