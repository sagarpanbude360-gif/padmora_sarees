-- Padmora: live content copy clean-up (PREVIEW ONLY, NOT APPLIED).
-- Nothing in this file has been run. It removes em dashes from text that is stored in the database (so the code change alone
-- cannot reach it) and fixes one repeated word. Each statement matches the EXACT current text, so it changes nothing if the
-- text was edited in the admin panel since this plan was written. Run it in the Supabase SQL editor only after approval.
-- Customer-authored text (reviews, messages) and the owner-written collection blurb are deliberately NOT touched.
--
-- BEFORE:   take a backup (Admin > Backups > Create backup) or copy the rows with the SELECT at the bottom.
-- VERIFY:   run the SELECT at the bottom after applying; every row should read as in the "AFTER" comments.
-- ROLLBACK: the ROLLBACK section restores each row to its exact previous text.

begin;

-- FAQ 1  (the closing sentence "see our Our Weaves page" repeats a word, and the page may not be linked from the menu, so it is dropped)
-- BEFORE: ... instead of marketing them as handloom — see our Our Weaves page for more.
-- AFTER:  ... instead of marketing them as handloom.
update public.faq_items set answer = replace(answer,
  'We disclose powerloom pieces honestly instead of marketing them as handloom — see our Our Weaves page for more.',
  'We disclose powerloom pieces honestly instead of marketing them as handloom.')
where id = 1 and answer like '%handloom — see our Our Weaves page for more.';

-- FAQ 2
-- AFTER: ... as is traditional. We don’t currently offer blouse stitching, so we recommend a trusted local tailor for the perfect fit.
update public.faq_items set answer = replace(answer,
  'We don’t currently offer blouse stitching services — we recommend a trusted local tailor for the perfect fit.',
  'We don’t currently offer blouse stitching, so we recommend a trusted local tailor for the perfect fit.')
where id = 2 and answer like '%blouse stitching services — we recommend%';

-- FAQ 7
-- AFTER: Yes. Message us via Contact Us and mention "Bulk Order" in the subject. Our team will follow up with a bundle discount for 5+ sarees.
update public.faq_items set answer = replace(answer, 'Yes — message us via Contact Us', 'Yes. Message us via Contact Us')
where id = 7 and answer like 'Yes — message us via Contact Us%';

-- FAQ 8
-- AFTER: Paithani, being pure silk, should be dry-cleaned only. Maheshwari, Ajrakh, and Narayanpet are cotton-silk or cotton weaves that can be gently hand-washed in cold water and dried in shade. Ajrakh especially benefits from a cold, separate first wash to set the natural dyes.
update public.faq_items set answer = replace(answer, 'dried in shade — Ajrakh especially', 'dried in shade. Ajrakh especially')
where id = 8 and answer like '%dried in shade — Ajrakh especially%';

-- Our Weaves: fabrics 2, 3, 6, 10
-- 2 AFTER: ... through a multi-day resist-printing process. A craft, not a print.
update public.fabrics set full_description = replace(full_description, 'resist-printing process — a craft, not a print.', 'resist-printing process. A craft, not a print.')
where id = 2 and full_description like '%resist-printing process — a craft, not a print.';
-- 3 AFTER: Pure silk woven with real zari, famous for its hand-woven peacock-motif pallu. Once reserved for Maratha royalty, it still takes over a month per piece.
update public.fabrics set full_description = replace(full_description, 'peacock-motif pallu — once reserved for Maratha royalty and still taking over a month per piece.', 'peacock-motif pallu. Once reserved for Maratha royalty, it still takes over a month per piece.')
where id = 3 and full_description like '%peacock-motif pallu — once reserved%';
-- 6 AFTER: ... wide contrast borders, and a wedding staple from South India for generations.
update public.fabrics set full_description = replace(full_description, 'wide contrast borders — a wedding staple from South India for generations.', 'wide contrast borders. A wedding staple from South India for generations.')
where id = 6 and full_description like '%wide contrast borders — a wedding staple%';
-- 10 AFTER: ... pre-dyed to align into one pattern. Among the most labor-intensive handloom crafts in India.
update public.fabrics set full_description = replace(full_description, 'into one pattern — among the most labor-intensive handloom crafts in India.', 'into one pattern. Among the most labor-intensive handloom crafts in India.')
where id = 10 and full_description like '%into one pattern — among the most labor-intensive%';

-- Home page hero (settings.hero_banner.subheading)
-- AFTER: From the looms of Maheshwar, Paithan and Narayanpet to the hand block-printers of Kutch, discover sarees curated for weddings, festivals, and everyday elegance.
update public.settings set value = replace(value, 'hand block-printers of Kutch — discover sarees', 'hand block-printers of Kutch, discover sarees')
where key = 'hero_banner' and value like '%hand block-printers of Kutch — discover sarees%';

-- Promo band heading (currently switched off, active:false)
-- AFTER: The Festive Sale: Up to 40% Off
update public.settings set value = replace(value, 'The Festive Sale — Up to 40% Off', 'The Festive Sale: Up to 40% Off')
where key = 'promo_band' and value like '%The Festive Sale — Up to 40% Off%';

commit;

-- VERIFY (expect zero rows once applied):
-- select 'faq' src, id::text, answer from public.faq_items where answer like '%—%'
-- union all select 'fabric', id::text, full_description from public.fabrics where full_description like '%—%'
-- union all select 'setting', key, value from public.settings where value like '%—%';

-- ROLLBACK (restores the exact previous text; run only if the changes need undoing):
-- begin;
-- update public.faq_items set answer = replace(answer, 'instead of marketing them as handloom.', 'instead of marketing them as handloom — see our Our Weaves page for more.') where id = 1;
-- update public.faq_items set answer = replace(answer, 'blouse stitching, so we recommend a trusted', 'blouse stitching services — we recommend a trusted') where id = 2;
-- update public.faq_items set answer = replace(answer, 'Yes. Message us via Contact Us', 'Yes — message us via Contact Us') where id = 7;
-- update public.faq_items set answer = replace(answer, 'dried in shade. Ajrakh especially', 'dried in shade — Ajrakh especially') where id = 8;
-- update public.fabrics set full_description = replace(full_description, 'process. A craft, not a print.', 'process — a craft, not a print.') where id = 2;
-- update public.fabrics set full_description = replace(full_description, 'peacock-motif pallu. Once reserved for Maratha royalty, it still takes over a month per piece.', 'peacock-motif pallu — once reserved for Maratha royalty and still taking over a month per piece.') where id = 3;
-- update public.fabrics set full_description = replace(full_description, 'wide contrast borders. A wedding staple', 'wide contrast borders — a wedding staple') where id = 6;
-- update public.fabrics set full_description = replace(full_description, 'into one pattern. Among the most', 'into one pattern — among the most') where id = 10;
-- update public.settings set value = replace(value, 'Kutch, discover sarees', 'Kutch — discover sarees') where key = 'hero_banner';
-- update public.settings set value = replace(value, 'The Festive Sale: Up to 40% Off', 'The Festive Sale — Up to 40% Off') where key = 'promo_band';
-- commit;
