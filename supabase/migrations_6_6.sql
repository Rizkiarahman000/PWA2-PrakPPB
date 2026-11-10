-- =====================================================
-- Migrasi 6.6.5 / 6.6.6 / 6.6.7 — Tugas Tambahan Laporan
-- Jalankan di Supabase Dashboard > SQL Editor
-- =====================================================

-- 6.6.5 — Soft delete / arsip (tambah kolom archived_at)
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- 6.6.7 — Banyak gambar per katalog (tambah kolom images JSONB)
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 6.6.6 — Like / dislike review (tambah kolom hitungan)
ALTER TABLE public.reviews
    ADD COLUMN IF NOT EXISTS likes INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.reviews
    ADD COLUMN IF NOT EXISTS dislikes INTEGER NOT NULL DEFAULT 0;

-- Tabel reaksi untuk mencegah duplikasi like/dislike per user
CREATE TABLE IF NOT EXISTS public.review_reactions (
    review_id BIGINT NOT NULL
        REFERENCES public.reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    reaction TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (review_id, user_id)
);

ALTER TABLE public.review_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all on review_reactions"
ON public.review_reactions;

DROP POLICY IF EXISTS "Allow authenticated all on review_reactions"
ON public.review_reactions;

CREATE POLICY "Allow public all on review_reactions"
ON public.review_reactions
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated all on review_reactions"
ON public.review_reactions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.review_reactions TO anon, authenticated;

-- =====================================================
-- Data awal (seed) contoh gambar ganda untuk produk 1
-- =====================================================
UPDATE public.products
SET images = jsonb_build_array(image_url)
WHERE image_url IS NOT NULL
  AND (images IS NULL OR images = '[]'::jsonb);