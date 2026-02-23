/**
 * KAK MASTER ADMIN JS
 * admin.js
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
        if (!dc) return;

        // 1. Fetch Complaints
        const { data: complaints, error: cErr } = await dc
            .from('complaints')
            .select('*')
            .order('submitted_at', { ascending: false });

        if (!cErr) {
            allComplaints = complaints;
            renderComplaints(allComplaints);
            updateStats(allComplaints);
        }

        // 2. Fetch Supervisors
        const { data: sups, error: sErr } = await dc
            .from('supervisor_stats')
            .select('*');

        if (!sErr) {
            renderSupervisors(sups);
            document.getElementById('total-supervisors').textContent = sups.length;
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
            `;
            complaintsBody.appendChild(tr);
        });
    }

    function renderSupervisors(list) {
        supervisorsBody.innerHTML = '';
        list.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><b>${s.supervisor_uid}</b></td>
                <td>${s.total_resolved}</td>
                <td>${s.total_missed}</td>
                <td>${s.black_points} ⚫</td>
                <td>${s.avg_rating ? s.avg_rating + ' ⭐' : '—'}</td>
            `;
            supervisorsBody.appendChild(tr);
        });
    }

    function updateStats(list) {
        document.getElementById('total-complaints').textContent = list.length;
        document.getElementById('active-complaints').textContent = list.filter(c => !['resolved', 'closed', 'ao_resolved'].includes(c.status)).length;
    }

    function setupEventListeners() {
        // Search
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allComplaints.filter(c =>
                c.ticket_id.toLowerCase().includes(term) ||
                c.block.toString().includes(term) ||
                c.issue_type.toLowerCase().includes(term) ||
                c.assigned_supervisor.toLowerCase().includes(term)
            );
            renderComplaints(filtered);
        });

        // Refresh
        document.getElementById('btn-refresh').addEventListener('click', loadData);

        // Wipe Logic
        document.getElementById('btn-wipe').addEventListener('click', () => {
            wipeModal.style.display = 'flex';
        });

        document.getElementById('cancel-wipe').addEventListener('click', () => {
            wipeModal.style.display = 'none';
        });

        document.getElementById('confirm-wipe').addEventListener('click', async () => {
            const btn = document.getElementById('confirm-wipe');
            btn.disabled = true;
            btn.textContent = 'WIPING...';

            const dc = window.supabaseClient;

            try {
                // 1. Delete all complaints
                const { error: cErr } = await dc.from('complaints').delete().neq('id', 0); // Delete all where ID != 0
                if (cErr) throw cErr;

                // 2. Reset Statistics
                const { error: sErr } = await dc.from('supervisor_stats').update({
                    total_resolved: 0,
                    total_assigned: 0,
                    total_missed: 0,
                    total_escalated: 0,
                    resolved_on_time: 0,
                    black_points: 0,
                    avg_rating: 0,
                    black_point_tickets: []
                }).neq('id', 0);
                if (sErr) throw sErr;

                alert('DATABASE WIPED SUCCESSFULLY. SYSTEM IS CLEAN.');
                window.location.reload();
            } catch (err) {
                console.error('NUCLEAR WIPE FAILED:', err);
                alert('WIPE FAILED: ' + err.message);
                btn.disabled = false;
                btn.textContent = 'YES, WIPE EVERYTHING';
            }
        });
    }

    init();

})();
