-- Product page "Product details" section: an optional, separately editable text per product (the Description section keeps
-- using products.description / each colour's description). Adds ONE nullable column and exposes it through the
-- products_blended view (the storefront reads products through that view, and a view does not pick up new columns by itself).
-- No existing data changes. Safe to run before or after deploying the code: the code works with or without a value, and the
-- live site on the older code ignores the new column.
alter table public.products add column if not exists details text;

-- Same definition as before with `details` added as the LAST column (CREATE OR REPLACE VIEW can only append columns).
create or replace view public.products_blended as
 SELECT p.id, p.name, p.fabric, p.occasion, p.price, p.mrp, p.rating, p.reviews_count, p.badge, p.swatch, p.description, p.stock,
    p.weaver_name, p.weaver_region, p.loom_type, p.reel_video, p.status,
        CASE
            WHEN (p.reviews_count + COALESCE(r.cnt, 0::bigint)) = 0 THEN 0::numeric
            ELSE round(((p.rating * p.reviews_count::double precision + COALESCE(r.sum_rating, 0::bigint)::double precision) / (p.reviews_count + COALESCE(r.cnt, 0::bigint))::double precision)::numeric, 1)
        END AS blended_rating,
    p.reviews_count + COALESCE(r.cnt, 0::bigint) AS blended_count,
    p.details
   FROM products p
     LEFT JOIN ( SELECT reviews.product_id, count(*) AS cnt, sum(reviews.rating) AS sum_rating
           FROM reviews WHERE reviews.status = 'published'::text GROUP BY reviews.product_id) r ON r.product_id = p.id;

notify pgrst, 'reload schema';

-- VERIFY:   select count(*) filter (where details is not null) as with_details, count(*) as products from public.products_blended;
-- ROLLBACK: (the view can only lose a column by being dropped and recreated, so run the original definition from git history)
--           drop view public.products_blended; <recreate without p.details>; alter table public.products drop column if exists details;
--           then re-apply the security_invoker setting if 2026-10-supabase-lockdown.sql was run.
