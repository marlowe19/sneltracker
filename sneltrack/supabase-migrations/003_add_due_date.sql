-- Add due_date column to notes table
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS due_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Create index on due_date for efficient filtering/sorting
CREATE INDEX IF NOT EXISTS idx_notes_due_date ON notes(due_date);

