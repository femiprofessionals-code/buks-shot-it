-- Portfolio management checks (Deliverable 8). Runs after 02_rules.sql in the same database.
\set ON_ERROR_STOP on
insert into public.portfolio_galleries (id, slug, title, category, permission_confirmed) values
  ('44444444-0000-0000-0000-000000000001', 'spring-wedding', 'A spring wedding', 'wedding', true),
  ('44444444-0000-0000-0000-000000000002', 'bakery-launch', 'Bakery launch', 'product', true);
insert into public.portfolio_photos (id, gallery_id, storage_key, width, height, alt, original_key, variants, sort) values
  ('55555555-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', 'pf/1', 2000, 1333, 'One', 'orig/1.jpg', '[{"w":640,"key":"pub/1-640.webp"},{"w":1280,"key":"pub/1-1280.webp"}]', 1),
  ('55555555-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000001', 'pf/2', 2000, 1333, 'Two', 'orig/2.jpg', '[{"w":640,"key":"pub/2-640.webp"}]', 2),
  ('55555555-0000-0000-0000-000000000003', '44444444-0000-0000-0000-000000000001', 'pf/3', 1333, 2000, 'Three', 'orig/3.jpg', '[]', 3),
  ('55555555-0000-0000-0000-000000000009', '44444444-0000-0000-0000-000000000002', 'pf/9', 2000, 2000, 'Nine', 'orig/9.jpg', '[]', 1);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.reorder_portfolio_photos('44444444-0000-0000-0000-000000000001', array['55555555-0000-0000-0000-000000000003','55555555-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000002']::uuid[]);
select public._check((select array_agg(alt order by sort) from public.portfolio_photos where gallery_id = '44444444-0000-0000-0000-000000000001') = array['Three','One','Two'], 'Admin can reorder photos');
select public._expect_error($$select public.reorder_portfolio_photos('44444444-0000-0000-0000-000000000001', array['55555555-0000-0000-0000-000000000003','55555555-0000-0000-0000-000000000009']::uuid[])$$, 'INVALID_ORDER', 'Reorder refuses photos from another gallery or a partial list');
update public.portfolio_galleries set cover_photo_id = '55555555-0000-0000-0000-000000000002' where id = '44444444-0000-0000-0000-000000000001';
select public._check((select cover_photo_id from public.portfolio_galleries where id = '44444444-0000-0000-0000-000000000001') = '55555555-0000-0000-0000-000000000002', 'Admin can set a cover photo');
select public._expect_error($$update public.portfolio_galleries set cover_photo_id = '55555555-0000-0000-0000-000000000009' where id = '44444444-0000-0000-0000-000000000001'$$, 'COVER_NOT_IN_GALLERY', 'Cover must come from the same gallery');
select public._expect_error($$insert into public.portfolio_galleries (slug, title, category) values ('weddings', 'X', 'wedding')$$, 'portfolio_slug_not_category', 'Gallery address cannot clash with a category page');
select public._expect_error($$insert into public.portfolio_galleries (slug, title, category) values ('Bad Slug!', 'X', 'wedding')$$, 'portfolio_slug_format', 'Gallery address must be lowercase words and hyphens');
reset role;

-- Visitors and clients
set role anon;
select public._check((select count(*) from public.public_portfolio) = 0, 'Unpublished galleries are not in the public portfolio');
select public._expect_error($$select public.reorder_portfolio_photos('44444444-0000-0000-0000-000000000001', array[]::uuid[])$$, '42501', 'Visitors cannot reorder photos');
select public._expect_error($$select public.queue_photo_files(p) from public.portfolio_photos p limit 1$$, '42501', 'Visitors cannot queue file deletions');
delete from public.portfolio_photos;
reset role;
select public._check((select count(*) from public.portfolio_photos) = 4, 'Visitors cannot delete photos (no rows removed)');
set role anon;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select public._expect_error($$select public.reorder_portfolio_photos('44444444-0000-0000-0000-000000000001', array['55555555-0000-0000-0000-000000000003','55555555-0000-0000-0000-000000000001','55555555-0000-0000-0000-000000000002']::uuid[])$$, 'FORBIDDEN', 'Clients cannot reorder photos');
select public._check((select count(*) from public.storage_deletions) = 0, 'Clients cannot read the storage queue');
reset role;

update public.portfolio_galleries set published = true where id = '44444444-0000-0000-0000-000000000001';
set role anon;
select public._check((select count(*) from public.public_portfolio) = 3, 'Published gallery appears in the public portfolio');
select public._check((select count(*) from public.public_portfolio where is_cover) = 1, 'Public portfolio marks the cover photo');
reset role;

-- Deleting and replacing photos queues their files for removal.
delete from public.portfolio_photos where id = '55555555-0000-0000-0000-000000000001';
select public._check((select count(*) from public.storage_deletions where key in ('orig/1.jpg','pub/1-640.webp','pub/1-1280.webp')) = 3, 'Deleting a photo queues its original and all sizes for removal');
update public.portfolio_photos set original_key = 'orig/2b.jpg', variants = '[{"w":640,"key":"pub/2b-640.webp"}]' where id = '55555555-0000-0000-0000-000000000002';
select public._check((select count(*) from public.storage_deletions where key in ('orig/2.jpg','pub/2-640.webp')) = 2, 'Replacing a photo queues the old files for removal');
select public._check((select count(*) from public.storage_deletions where key like '%2b%') = 0, 'Replacing a photo keeps the new files');

select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from public._results;
