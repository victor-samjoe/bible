-- Personal reading data. This migration is intentionally not applied automatically.
-- RLS is fail-closed: every client operation must match auth.uid().

CREATE TYPE reading_highlight_color AS ENUM ('yellow', 'green', 'blue', 'pink', 'purple');
CREATE TYPE reading_font_family AS ENUM ('serif', 'sans', 'dyslexic');

CREATE TABLE reading_preferences (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'dark' CHECK (theme IN ('light', 'dark', 'system')),
  font_family reading_font_family NOT NULL DEFAULT 'serif',
  font_size smallint NOT NULL DEFAULT 18 CHECK (font_size BETWEEN 12 AND 32),
  line_height numeric(3,2) NOT NULL DEFAULT 1.70 CHECK (line_height BETWEEN 1.20 AND 2.40),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE verse_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  verse_id uuid NOT NULL REFERENCES verses(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verse_notes_owner_verse_idx ON verse_notes(user_id, verse_id, updated_at DESC);

CREATE TABLE verse_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  verse_id uuid NOT NULL REFERENCES verses(id) ON DELETE CASCADE,
  color reading_highlight_color NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, verse_id)
);
CREATE INDEX verse_highlights_owner_color_idx ON verse_highlights(user_id, color, updated_at DESC);

CREATE TABLE chapter_reading_progress (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  last_verse_id uuid REFERENCES verses(id) ON DELETE SET NULL,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, chapter_id)
);
CREATE INDEX chapter_reading_progress_owner_completed_idx ON chapter_reading_progress(user_id, completed_at DESC NULLS LAST);

ALTER TABLE reading_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE verse_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE verse_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_reading_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY reading_preferences_owner ON reading_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY verse_notes_owner ON verse_notes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY verse_highlights_owner ON verse_highlights
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY chapter_reading_progress_owner ON chapter_reading_progress
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE FUNCTION touch_personal_reading_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER reading_preferences_touch BEFORE UPDATE ON reading_preferences FOR EACH ROW EXECUTE FUNCTION touch_personal_reading_updated_at();
CREATE TRIGGER verse_notes_touch BEFORE UPDATE ON verse_notes FOR EACH ROW EXECUTE FUNCTION touch_personal_reading_updated_at();
CREATE TRIGGER verse_highlights_touch BEFORE UPDATE ON verse_highlights FOR EACH ROW EXECUTE FUNCTION touch_personal_reading_updated_at();
CREATE TRIGGER chapter_reading_progress_touch BEFORE UPDATE ON chapter_reading_progress FOR EACH ROW EXECUTE FUNCTION touch_personal_reading_updated_at();
