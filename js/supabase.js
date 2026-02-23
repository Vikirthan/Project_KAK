/* ===================================================
   KAK HYGIENE SYSTEM — Primary Data Backend (MATRIX)
   Project: https://lnnuiblwjyqzyzzfqyla.supabase.co
   =================================================== */

const SUPABASE_URL = 'https://lnnuiblwjyqzyzzfqyla.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxubnVpYmx3anlxenl6emZxeWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NDAwOTksImV4cCI6MjA4NzQxNjA5OX0.ixOq9ECkgdrt8YvMZWTDoET3OkA6RLvOv_MMII-EycU';

// Initialise the Supabase client (requires @supabase/supabase-js CDN loaded first)
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Storage bucket name
const PHOTO_BUCKET = 'database';

/* --------------------------------------------------
   uploadComplaintPhoto(dataUrl, studentUID, ticketId)
   Converts a base64 data URL to a Blob, uploads it to
   Supabase Storage, and returns the public URL.
   Returns null on failure (form still submits with
   a localStorage base64 fallback).
-------------------------------------------------- */
async function uploadComplaintPhoto(dataUrl, studentUID, ticketId) {
    try {
        // Fetch the data URL as a Blob (handles any image type)
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const ext = blob.type.split('/')[1] || 'jpg';         // e.g. "jpeg", "png"
        const path = `${studentUID}/${ticketId}.${ext}`;       // e.g. "123/KAK-20250221-A1B2.jpeg"

        const { error: uploadErr } = await supabaseClient
            .storage
            .from(PHOTO_BUCKET)
            .upload(path, blob, {
                contentType: blob.type,
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadErr) {
            console.error('[KAK] Photo upload error:', uploadErr.message);
            return null;
        }

        // Get the permanent public URL
        const { data } = supabaseClient.storage.from(PHOTO_BUCKET).getPublicUrl(path);
        return data.publicUrl;                                  // e.g. https://...supabase.co/storage/v1/object/public/...

    } catch (err) {
        console.error('[KAK] uploadComplaintPhoto exception:', err);
        return null;
    }
}

/* --------------------------------------------------
   saveComplaintToDB(complaint)
   Inserts a complaint record into the `complaints`
   table in Supabase. Returns { success, error }.
-------------------------------------------------- */
async function saveComplaintToDB(complaint) {
    const { error } = await supabaseClient.from('complaints').insert([{
        ticket_id: complaint.ticketId,
        student_uid: complaint.studentUID,
        student_name: complaint.studentName,
        reg_no: complaint.regNo,
        phone: complaint.phone,
        block: complaint.block,
        issue_type: complaint.issueType,
        description: complaint.description,
        photo_url: complaint.photo,        // public URL (or null)
        status: complaint.status,
        submitted_at: complaint.submittedAt,
        supervisor_deadline: complaint.supervisorDeadline,
        assigned_supervisor: complaint.assignedSupervisor,
        escalated: complaint.escalated,
        student_approved: complaint.studentApproved,
    }]);

    if (error) {
        console.error('[KAK] DB insert error:', error.message);
        return { success: false, error };
    }
    return { success: true };
}

/* --------------------------------------------------
   fetchMyComplaints(studentUID)
   Fetches all complaints for a given student UID
   from Supabase, ordered newest-first.
   Returns an array (empty on error).
-------------------------------------------------- */
async function fetchMyComplaints(studentUID) {
    const { data, error } = await supabaseClient
        .from('complaints')
        .select('*')
        .eq('student_uid', studentUID)
        .order('submitted_at', { ascending: false });

    if (error) {
        console.error('[KAK] fetchMyComplaints error:', error.message);
        return [];
    }
    // Normalise column names to camelCase to match existing app code
    return (data || []).map(row => ({
        ticketId: row.ticket_id,
        studentUID: row.student_uid,
        studentName: row.student_name,
        regNo: row.reg_no,
        phone: row.phone,
        block: row.block,
        issueType: row.issue_type,
        description: row.description,
        photo: row.photo_url,
        status: row.status,
        submittedAt: row.submitted_at,
        supervisorDeadline: row.supervisor_deadline,
        assignedSupervisor: row.assigned_supervisor,
        escalated: row.escalated,
        studentApproved: row.student_approved,
    }));
}
