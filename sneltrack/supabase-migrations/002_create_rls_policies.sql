-- RLS Policies for notes table
-- Note: For authenticated users, we use service role key server-side (bypasses RLS)
-- These policies are mainly for anonymous access via share_token

-- Policy: Allow anonymous access via share_token (for shared notes)
CREATE POLICY "Anonymous can view shared notes via token"
  ON notes FOR SELECT
  TO anon
  USING (share_token IS NOT NULL);

-- Policy: Allow anonymous to update shared notes via token
CREATE POLICY "Anonymous can update shared notes via token"
  ON notes FOR UPDATE
  TO anon
  USING (share_token IS NOT NULL);

-- Policy: Allow anon users to manage notes (security checks in app code)
-- For POC: minimal security, mainly testing real-time capabilities
CREATE POLICY "Anon users can manage notes"
  ON notes
  TO anon
  USING (true)
  WITH CHECK (true);

-- RLS Policies for note_items table

-- Policy: Allow anonymous access to items in shared notes
CREATE POLICY "Anonymous can view items in shared notes"
  ON note_items FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_items.note_id
      AND notes.share_token IS NOT NULL
    )
  );

-- Policy: Allow anonymous to create items in shared notes
CREATE POLICY "Anonymous can create items in shared notes"
  ON note_items FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_items.note_id
      AND notes.share_token IS NOT NULL
    )
  );

-- Policy: Allow anonymous to update items in shared notes
CREATE POLICY "Anonymous can update items in shared notes"
  ON note_items FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_items.note_id
      AND notes.share_token IS NOT NULL
    )
  );

-- Policy: Allow anonymous to delete items in shared notes
CREATE POLICY "Anonymous can delete items in shared notes"
  ON note_items FOR DELETE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_items.note_id
      AND notes.share_token IS NOT NULL
    )
  );

-- Policy: Allow anon users to manage note items (security checks in app code)
-- For POC: minimal security, mainly testing real-time capabilities
CREATE POLICY "Anon users can manage note items"
  ON note_items
  TO anon
  USING (true)
  WITH CHECK (true);

