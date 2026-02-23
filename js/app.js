/* ===========================
   KAK HYGIENE SYSTEM
   Global Utilities + Auth
   =========================== */

// =============================================
// CREDENTIALS (All roles — dummy for testing)
// =============================================
const KAK_USERS = {
  // ---------- STUDENTS ----------
  '123': { password: 'Viki', role: 'student', name: 'Vikirthan T', uid: '123', redirectTo: '../student/index.html' },
  '456': { password: 'Viki', role: 'student', name: 'Arun Kumar S', uid: '456', redirectTo: '../student/index.html' },
  '789': { password: 'Viki', role: 'student', name: 'Priya Sharma', uid: '789', redirectTo: '../student/index.html' },

  // ---------- SUPERVISORS ----------
  'sup': { password: 'Viki', role: 'supervisor', name: 'Supervisor – Block 36', block: '36', uid: 'SUP-36', redirectTo: '../supervisor/index.html' },
  'sup2': { password: 'Viki', role: 'supervisor', name: 'Supervisor – Block 35', block: '35', uid: 'SUP-35', redirectTo: '../supervisor/index.html' },
  'sup3': { password: 'Viki', role: 'supervisor', name: 'Supervisor – Block 34', block: '34', uid: 'SUP-34', redirectTo: '../supervisor/index.html' },

  // ---------- AO OFFICE ----------
  'ao': { password: 'Viki', role: 'ao', name: 'AO Office – Block 36', block: '36', uid: 'AO-36', redirectTo: '../ao/index.html' },
  'ao35': { password: 'Viki', role: 'ao', name: 'AO Office – Block 35', block: '35', uid: 'AO-35', redirectTo: '../ao/index.html' },
  'ao34': { password: 'Viki', role: 'ao', name: 'AO Office – Block 34', block: '34', uid: 'AO-34', redirectTo: '../ao/index.html' },

  // ---------- VENDOR ----------
  'ven': { password: 'Viki', role: 'vendor', name: 'Vendor Manager', uid: 'VEN-001', redirectTo: '../vendor/index.html' },

  // ---------- MASTER ADMIN ----------
  'Vikirthan': { password: 'Viki', role: 'admin', name: 'Master Admin – Vikirthan', uid: 'ADMIN-01', redirectTo: '../master/index.html' },
};

// =============================================
// STUDENT PROFILES — pre-filled in complaint form
// =============================================
const STUDENT_PROFILES = {
  '123': { name: 'Vikirthan T', regNo: '12301234', phone: '9876543210' },
  '456': { name: 'Arun Kumar S', regNo: '45601234', phone: '9865432101' },
  '789': { name: 'Priya Sharma', regNo: '78901234', phone: '9754321089' },
};

// Role label & icon map
const ROLE_META = {
  student: { label: 'Student', icon: '🎓', color: '#6366f1' },
  supervisor: { label: 'Supervisor', icon: '🔧', color: '#06b6d4' },
  ao: { label: 'AO Office', icon: '🏢', color: '#f59e0b' },
  vendor: { label: 'Vendor Manager', icon: '👔', color: '#8b5cf6' },
};

// =============================================
// AUTH HELPERS
// =============================================

/** Attempt login — returns user object or null */
function kakLogin(uid, password) {
  uid = (uid || '').trim();
  password = (password || '').trim();
  const user = KAK_USERS[uid];
  if (user && user.password === password) return user;
  return null;
}

/** Save the current session to localStorage — UID-specific to allow multi-user testing */
function kakSetSession(user) {
  KAK.save('last_uid', user.uid);
  KAK.save('session_' + user.uid, {
    uid: user.uid,
    username: Object.keys(KAK_USERS).find(k => KAK_USERS[k] === user) || user.uid,
    role: user.role,
    name: user.name,
    block: user.block || null,
    loggedInAt: new Date().toISOString()
  });
}

/** Get session for a specific role or UID */
function kakGetSession(target) {
  // 1. Try to get UID from URL parameter first (e.g. index.html?uid=SUP-36)
  const params = new URLSearchParams(window.location.search);
  const urlUID = params.get('uid');
  if (urlUID) {
    const s = KAK.get('session_' + urlUID);
    if (s) return s;
  }

  // 2. Try most recent login
  const last = KAK.get('last_uid');
  if (last) {
    const s = KAK.get('session_' + last);
    if (s && (!target || s.role === target || s.uid === target)) return s;
  }

  // 3. Fallback: Search all saved sessions for the target role
  if (target) {
    const all = localStorage;
    for (let key in all) {
      if (key.startsWith('kak_session_')) {
        try {
          const s = JSON.parse(all[key]);
          if (s.role === target || s.uid === target) return s;
        } catch (e) { continue; }
      }
    }
  }
  return null;
}

/** Clear session */
function kakLogout(uid) {
  if (uid) KAK.remove('session_' + uid);
  else {
    const all = localStorage;
    for (let key in all) if (key.startsWith('kak_session_')) localStorage.removeItem(key);
    KAK.remove('last_uid');
    KAK.remove('last_session');
  }
  window.location.href = '../index.html';
}

/** Compute relative base path depending on depth */
function getBasePath() {
  const path = window.location.pathname.replace(/\\/g, '/');
  const depth = (path.match(/\//g) || []).length;
  // If at root (PROJECT_KAK/index.html) → '' else go up one level
  return path.endsWith('/index.html') && depth <= 2 ? '' : '../';
}

// =============================================
// TICKET ID
// =============================================
function generateTicketId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'KAK-';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// =============================================
// DATE / TIME FORMATTERS
// =============================================
function formatTime(date) {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateTime(date) {
  return date.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

// =============================================
// LOCAL STORAGE HELPERS
// =============================================
const KAK = {
  save(key, value) { localStorage.setItem('kak_' + key, JSON.stringify(value)); },
  get(key) { try { return JSON.parse(localStorage.getItem('kak_' + key)); } catch { return null; } },
  remove(key) { localStorage.removeItem('kak_' + key); }
};

// =============================================
// COMPLAINT HELPERS (SUPABASE INTEGRATION)
// =============================================

/** 
 * Unified Backend Config:
 * uses window.supabaseClient (from js/supabase.js) for everything.
 */
function getClient() { return window.supabaseClient; }

/** 
 * Map local JS object keys to Supabase Column Names
 */
const DB_MAP = {
  id: 'id',
  ticketId: 'ticket_id',
  studentUID: 'student_uid',
  studentName: 'student_name',
  regNo: 'reg_no',
  phone: 'phone',
  block: 'block',
  issueType: 'issue_type',
  description: 'description',
  photo: 'photo_url',
  status: 'status',
  submittedAt: 'submitted_at',
  supervisorDeadline: 'supervisor_deadline',
  assignedSupervisor: 'assigned_supervisor',
  supervisorPhoto: 'supervisor_photo',
  resolutionPhoto: 'supervisor_photo', // alias
  studentApproved: 'student_approved',
  studentRating: 'student_rating',
  escalated: 'escalated',
  timeline: 'timeline',
  aoDeadline: 'ao_deadline',
  aoAlertAt: 'ao_alert_at',
  aoMissedPointAwarded: 'ao_missed_point_awarded',
  resolvedAt: 'resolved_at',
  aoResolvedAt: 'ao_resolved_at',
  aoResolutionPhoto: 'ao_resolution_photo',
  resolvedOnTime: 'resolved_on_time',
  acceptanceDeadline: 'acceptance_deadline',
  autoAccepted: 'auto_accepted'
};

/** Fetch all complaints from Supabase */
async function getComplaints() {
  const dc = getClient();
  if (!dc) return KAK.get('complaints') || [];

  const { data, error } = await dc
    .from('complaints')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[KAK-DATA] Error fetching complaints:', error);
    return KAK.get('complaints') || [];
  }

  // Map DB columns back to JS keys
  return data.map(row => ({
    ticketId: row.ticket_id,
    studentUID: row.student_uid,
    studentName: row.student_name,
    regNo: row.reg_no,
    phone: row.phone,
    block: row.block,
    issueType: row.issue_type,
    description: row.description,
    photo: row.photo_url,
    photoUrl: row.photo_url,
    status: row.status,
    submittedAt: row.submitted_at,
    supervisorDeadline: row.supervisor_deadline,
    assignedSupervisor: row.assigned_supervisor,
    supervisorPhoto: row.supervisor_photo,
    resolutionPhoto: row.supervisor_photo,
    studentApproved: row.student_approved,
    studentRating: row.student_rating,
    escalated: row.escalated,
    timeline: row.timeline || [],
    aoDeadline: row.ao_deadline,
    aoAlertAt: row.ao_alert_at,
    aoMissedPointAwarded: row.ao_missed_point_awarded,
    resolvedAt: row.resolved_at,
    aoResolvedAt: row.ao_resolved_at,
    aoResolutionPhoto: row.ao_resolution_photo,
    resolvedOnTime: row.resolved_on_time,
    acceptanceDeadline: row.acceptance_deadline,
    autoAccepted: row.auto_accepted,
    id: row.id
  }));
}

/** Add a new complaint to Supabase */
async function addComplaint(c) {
  const dc = getClient();
  if (!dc) {
    const l = KAK.get('complaints') || [];
    l.push(c);
    KAK.save('complaints', l);
    return;
  }

  const row = {};
  for (const jsKey in DB_MAP) {
    const dbKey = DB_MAP[jsKey];
    if (c[jsKey] !== undefined) row[dbKey] = c[jsKey];
  }

  console.log('[KAK-DATA] Attempting Insert into MATRIX:', row);
  const { error } = await dc.from('complaints').insert([row]);

  if (error) {
    console.error('[KAK-DATA] Error adding complaint:', error);
    throw error; // Rethrow to show alert in UI
  } else {
    try {
      // Also increment total_assigned in stats
      const stat = getSupStat(c.assignedSupervisor);
      saveSupStat(c.assignedSupervisor, {
        totalAssigned: (stat.totalAssigned || 0) + 1
      });
      console.log('[KAK-DATA] Stats updated for:', c.assignedSupervisor);
    } catch (statErr) {
      console.warn('[KAK-DATA] Stats update failed (non-critical):', statErr);
    }
  }
}

/** Update a complaint in Supabase */
async function updateComplaint(ticketId, patch) {
  const dc = getClient();
  if (!dc) {
    const list = KAK.get('complaints') || [];
    const idx = list.findIndex(c => c.ticketId === ticketId);
    if (idx === -1) return;
    list[idx] = { ...list[idx], ...patch };
    KAK.save('complaints', list);
    return list[idx];
  }

  // Map patch keys to DB columns
  const dbPatch = {};
  for (const key in patch) {
    const dbKey = DB_MAP[key];
    if (dbKey) dbPatch[dbKey] = patch[key];
  }

  const { data, error } = await dc
    .from('complaints')
    .update(dbPatch)
    .eq('ticket_id', ticketId)
    .select();

  if (error) console.error('[KAK-DATA] Error updating complaint:', error);
  return data ? data[0] : null;
}

/** Upload a photo to Supabase Storage and return the public URL */
async function uploadPhotoToSupabase(fileOrDataURL, fileName) {
  const pc = getClient();
  if (!pc) {
    console.error('[KAK-PHOTO] Supabase client not initialized.');
    return fileOrDataURL;
  }

  try {
    let blob;
    if (typeof fileOrDataURL === 'string' && fileOrDataURL.startsWith('data:')) {
      const res = await fetch(fileOrDataURL);
      blob = await res.blob();
    } else {
      blob = fileOrDataURL;
    }

    const filePath = `${Date.now()}_${fileName}`;
    const { data, error } = await pc.storage
      .from('hygiene-reports')
      .upload(filePath, blob, { contentType: blob.type });

    if (error) {
      console.error('[KAK-PHOTO] Upload error details:', error);
      throw error;
    }

    const { data: { publicUrl } } = pc.storage // Changed photoClient to pc
      .from('hygiene-reports')
      .getPublicUrl(filePath);

    console.log('[KAK-PHOTO] Upload success:', publicUrl);
    return publicUrl;
  } catch (err) {
    console.error('[KAK-PHOTO] Photo upload process failed:', err);
    return typeof fileOrDataURL === 'string' ? fileOrDataURL : null;
  }
}

/** Delete a photo from Supabase Storage */
async function deletePhotoFromSupabase(publicURL) {
  const pc = getClient();
  if (!pc || !publicURL) return;

  try {
    // Extract internal path from public URL
    // Format: https://.../storage/v1/object/public/hygiene-reports/PATH
    const path = publicURL.split('/hygiene-reports/').pop();
    const { error } = await pc.storage.from('hygiene-reports').remove([path]);

    if (error) console.error('Error deleting photo:', error);
  } catch (err) {
    console.error('Photo deletion failed:', err);
  }
}

/** Get all complaints assigned to a supervisor UID */
async function getComplaintsForSupervisor(supUID) {
  const all = await getComplaints();
  return all.filter(c => c.assignedSupervisor === supUID);
}

/** Get all escalated (pending_ao) complaints */
async function getEscalatedComplaints() {
  const all = await getComplaints();
  return all.filter(c => c.status === 'pending_ao');
}

// =============================================
// ESCALATION ENGINE — 2-tier black point system
// =============================================
async function runEscalationEngine() {
  const now = Date.now();
  const list = await getComplaints();
  let changed = false;

  for (const c of list) {
    // ── TIER 0: Acceptance Window (10 mins) ──
    if (c.status === 'pending_acceptance' && c.acceptanceDeadline) {
      if (now > new Date(c.acceptanceDeadline).getTime()) {
        const patch = {
          status: 'pending_supervisor', // Automatically accepts
          autoAccepted: true,           // Flag for loud alerts
          supervisorDeadline: new Date(now + 30 * 60 * 1000).toISOString(),
          timeline: [...(c.timeline || []), {
            event: 'System AUTO-ACCEPTED: Supervisor failed to respond in 10 mins. Resolution timer started.',
            time: new Date().toISOString(), by: 'system'
          }]
        };
        await updateComplaint(c.ticketId, patch);
        changed = true;
      }
    }

    // ── TIER 1: Resolution Window (30 mins) ──
    if (c.status === 'pending_supervisor' && c.supervisorDeadline) {
      if (now > new Date(c.supervisorDeadline).getTime()) {
        const patch = {
          status: 'pending_ao',
          aoDeadline: new Date(now + 30 * 60 * 1000).toISOString(),
          escalated: true,
          timeline: [...(c.timeline || []), {
            event: 'Escalated to AO: Supervisor missed 30m resolution window (⚫ 1st BP)',
            time: new Date().toISOString(), by: 'system'
          }]
        };
        await updateComplaint(c.ticketId, patch);
        changed = true;
        addBlackPoint(c.assignedSupervisor, c.ticketId + '_miss_resolution');
      }
    }

    // ── TIER 2: AO Overtime Window (Additional 30 mins) ──
    if (c.status === 'pending_ao' && c.aoDeadline && !c.aoMissedPointAwarded) {
      if (now > new Date(c.aoDeadline).getTime()) {
        const patch = {
          aoMissedPointAwarded: true,
          status: 'closed_overdue',
          timeline: [...(c.timeline || []), {
            event: 'System Closed: Final 30m grace period missed (⚫ another BP)',
            time: new Date().toISOString(), by: 'system'
          }]
        };
        await updateComplaint(c.ticketId, patch);
        changed = true;
        addBlackPoint(c.assignedSupervisor, c.ticketId + '_miss_final');
      }
    }
  }
}


// =============================================
// SUPERVISOR STATS & BLACK POINTS
// =============================================
// =============================================
// SUPERVISOR STATS & BLACK POINTS (DB SYNC)
// =============================================
const SUP_STATS_KEY = 'sup_stats';

const STATS_DB_MAP = {
  supervisor_uid: 'supervisor_uid',
  blackPoints: 'black_points',
  totalResolved: 'total_resolved',
  totalAssigned: 'total_assigned',
  totalMissed: 'total_missed',
  totalEscalated: 'total_escalated',
  resolvedOnTime: 'resolved_on_time',
  avgRating: 'avg_rating',
  blackPointTickets: 'black_point_tickets'
};

async function getSupStat(supUID) {
  const dc = getClient();
  if (!dc) return KAK.get(SUP_STATS_KEY)?.[supUID] || { supUID, blackPoints: 0, blackPointTickets: [], ratings: [], resolvedOnTime: 0, totalAssigned: 0, totalMissed: 0, totalEscalated: 0 };

  const { data, error } = await dc
    .from('supervisor_stats')
    .select('*')
    .eq('supervisor_uid', supUID)
    .single();

  if (error) {
    return { supUID, blackPoints: 0, blackPointTickets: [], ratings: [], resolvedOnTime: 0, totalAssigned: 0, totalMissed: 0, totalEscalated: 0 };
  }

  return {
    supUID: data.supervisor_uid,
    blackPoints: data.black_points,
    totalResolved: data.total_resolved,
    totalAssigned: data.total_assigned,
    totalMissed: data.total_missed,
    totalEscalated: data.total_escalated,
    resolvedOnTime: data.resolved_on_time,
    avgRating: parseFloat(data.avg_rating || 0),
    blackPointTickets: data.black_point_tickets || []
  };
}

async function updateSupStat(supUID, patch) {
  const dc = getClient();
  if (!dc) return;

  const dbPatch = {};
  for (const jsKey in patch) {
    const dbKey = STATS_DB_MAP[jsKey];
    if (dbKey) dbPatch[dbKey] = patch[jsKey];
  }

  const { error } = await dc
    .from('supervisor_stats')
    .upsert({ supervisor_uid: supUID, ...dbPatch, updated_at: new Date().toISOString() });

  if (error) console.error('[KAK-STATS] Error updating stats:', error);
}

async function addBlackPoint(supUID, ticketId) {
  const stat = await getSupStat(supUID);
  if (stat.blackPointTickets.includes(ticketId)) return;

  await updateSupStat(supUID, {
    blackPoints: (stat.blackPoints || 0) + 1,
    blackPointTickets: [...(stat.blackPointTickets || []), ticketId],
    totalMissed: (stat.totalMissed || 0) + 1
  });
}

async function addRatingToStats(supUID, rating, ticketId) {
  const complaints = await getComplaintsForSupervisor(supUID);
  const rated = complaints.filter(c => c.studentRating > 0);

  // Calculate new average
  const totalRating = rated.reduce((sum, c) => sum + c.studentRating, 0);
  const newAvg = rated.length > 0 ? (totalRating / rated.length).toFixed(1) : rating;

  await updateSupStat(supUID, {
    avgRating: parseFloat(newAvg),
    totalResolved: complaints.filter(c => c.status === 'resolved' || c.status === 'closed').length
  });
}

async function recordResolutionStats(supUID, onTime) {
  const stat = await getSupStat(supUID);
  const patch = {};
  if (onTime) patch.resolvedOnTime = (stat.resolvedOnTime || 0) + 1;
  patch.totalResolved = (stat.totalResolved || 0) + 1;
  await updateSupStat(supUID, patch);
}

/** Supervisor ranking: sorted by rating desc, black points asc, missed asc */
async function getSupervisorRanking() {
  const dc = getClient();
  if (!dc) return [];

  const { data, error } = await dc
    .from('supervisor_stats')
    .select('*')
    .order('avg_rating', { ascending: false });

  if (error || !data) return [];

  return data.map((s, index) => ({
    uid: s.supervisor_uid,
    name: KAK_USERS[Object.keys(KAK_USERS).find(k => KAK_USERS[k].uid === s.supervisor_uid)]?.name || s.supervisor_uid,
    block: s.supervisor_uid.split('-')[1],
    blackPoints: s.black_points,
    resolvedOnTime: s.resolved_on_time,
    totalAssigned: s.total_assigned,
    missed: s.total_missed,
    rating: parseFloat(s.avg_rating || 0),
    flagged: s.black_points >= 5,
  })).sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    if (a.blackPoints !== b.blackPoints) return a.blackPoints - b.blackPoints;
    return a.missed - b.missed;
  });
}

/** ms remaining until a deadline string — negative if overdue */
function msUntil(deadlineISO) {
  return new Date(deadlineISO).getTime() - Date.now();
}

/** Format countdown mm:ss */
function formatCountdown(ms) {
  if (ms <= 0) return '00:00';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

// =============================================
// BLOCK HYGIENE RANKING RENDERER
// =============================================
async function renderBlockRanking() {
  const container = document.getElementById('ranking-sidebar-list');
  if (!container) return;

  const ranking = await getSupervisorRanking();
  container.innerHTML = '';

  ranking.forEach((sup, index) => {
    const item = document.createElement('div');
    item.className = `ranking-item rank-${index + 1}`;

    let badgeClass = 'badge-neutral';
    if (index === 0) badgeClass = 'badge-gold';
    else if (index === 1) badgeClass = 'badge-silver';
    else if (index === 2) badgeClass = 'badge-bronze';

    const ratingVal = sup.rating || 0;
    const ratingDisplay = ratingVal > 0 ? ratingVal : '–';

    item.innerHTML = `
      <div class="rank-block">
        <span class="rank-block-label">Block ${sup.block}</span>
        <span class="rank-block-sub">${sup.resolvedOnTime} resolved · ${sup.blackPoints}⚫</span>
      </div>
      <div class="rank-badge ${badgeClass}">${ratingDisplay}⭐</div>
    `;
    container.appendChild(item);
  });
}

// Global auto-refresh for block ranking (if container exists)
if (document.getElementById('ranking-sidebar-list')) {
  renderBlockRanking();
  setInterval(renderBlockRanking, 10000);
}
