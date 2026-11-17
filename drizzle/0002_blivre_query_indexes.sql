-- BLIVRE corpus is loaded by scripts/import-blivre.ts. This migration only
-- adds access paths; it does not insert copyrighted or licensed text itself.
CREATE INDEX IF NOT EXISTS books_translation_order_idx ON books(translation_id, order_no);
CREATE INDEX IF NOT EXISTS chapters_book_number_idx ON chapters(book_id, number);
CREATE INDEX IF NOT EXISTS verses_chapter_number_idx ON verses(chapter_id, number);

