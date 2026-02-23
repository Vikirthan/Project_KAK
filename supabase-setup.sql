-- ============================================================
--  KAK HYGIENE SYSTEM — Supabase Setup SQL (FINAL VERSION)
--  Run all of this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. COMPLAINTS TABLE
CREATE TABLE IF NOT EXISTS complaints (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id               TEXT        UNIQUE NOT NULL,
  student_uid             TEXT        NOT NULL,
  student_name            TEXT,
  reg_no                  TEXT,
  phone                   TEXT,
  block                   TEXT,
  issue_type              TEXT,
  description             TEXT,
  photo_url               TEXT,                          -- Student's complaint photo
  status                  TEXT        DEFAULT 'pending_supervisor',
  submitted_at            TIMESTAMPTZ DEFAULT NOW(),
  supervisor_deadline     TIMESTAMPTZ,
  assigned_supervisor     TEXT,
  supervisor_photo        TEXT,                          -- Resolution photo (Supervisor)
  student_approved        BOOLEAN     DEFAULT FALSE,
  student_rating          INTEGER,                       -- 1-5 Student Rating
  escalated               BOOLEAN     DEFAULT FALSE,
  timeline                JSONB       DEFAULT '[]'::jsonb, -- Event history
  
  -- AO & Escalation Fields
  ao_deadline             TIMESTAMPTZ,
  ao_alert_at             TIMESTAMPTZ,
  ao_missed_point_awarded BOOLEAN     DEFAULT FALSE,
  resolved_at             TIMESTAMPTZ,
  ao_resolved_at          TIMESTAMPTZ,
  ao_resolution_photo     TEXT,                          -- AO's resolution photo
  resolved_on_time        BOOLEAN     DEFAULT FALSE,
  
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

-- Allow public access for testing (adjust for production)
CREATE POLICY "Public Access" ON complaints FOR ALL USING (true) WITH CHECK (true);

-- 2. STORAGE BUCKET POLICIES
--    First: Go to Supabase → Storage → Create bucket
--    Bucket name: complaint-photos
--    Make it PUBLIC (toggle on)
--    Then run the policies below:
-- ============================================================
CREATE POLICY "Public Attachment Upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'complaint-photos');

CREATE POLICY "Public Attachment View" ON storage.objects
  FOR SELECT USING (bucket_id = 'complaint-photos');

CREATE POLICY "Public Attachment Delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'complaint-photos');
