-- ============================================================
-- SETUP WAJIB: Storage bucket untuk foto menu
-- ============================================================
-- Jalankan script ini SEKALI di Supabase Dashboard > SQL Editor
-- (project: rjxhijozmznqvkxqbywr) sebelum fitur upload foto menu
-- di halaman menu.html bisa dipakai.

-- Fitur "URL Foto" sudah diganti jadi upload foto langsung dari
-- HP/komputer. Foto disimpan di Supabase Storage bucket bernama
-- "menu-photos", lalu URL publiknya otomatis disimpan ke kolom
-- menu_items.image_url (sama seperti sebelumnya, jadi tidak perlu
-- migrasi data lama).
-- ============================================================

-- 1) Buat bucket publik untuk foto menu (aman dibaca semua orang,
--    karena memang foto menu perlu tampil di halaman pelanggan)
insert into storage.buckets (id, name, public)
values ('menu-photos', 'menu-photos', true)
on conflict (id) do nothing;

-- 2) Siapa saja boleh MELIHAT foto (perlu, karena menu-pelanggan.html
--    diakses publik tanpa login)
drop policy if exists "Public read menu photos" on storage.objects;
create policy "Public read menu photos"
on storage.objects for select
using ( bucket_id = 'menu-photos' );

-- 3) Hanya user yang sudah login (pemilik restoran) yang boleh UPLOAD foto baru
drop policy if exists "Authenticated upload menu photos" on storage.objects;
create policy "Authenticated upload menu photos"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'menu-photos' );

-- 4) Hanya user yang sudah login yang boleh UPDATE/replace foto
drop policy if exists "Authenticated update menu photos" on storage.objects;
create policy "Authenticated update menu photos"
on storage.objects for update
to authenticated
using ( bucket_id = 'menu-photos' );

-- 5) Hanya user yang sudah login yang boleh HAPUS foto (dipakai saat
--    ganti/hapus foto menu dari menu.html)
drop policy if exists "Authenticated delete menu photos" on storage.objects;
create policy "Authenticated delete menu photos"
on storage.objects for delete
to authenticated
using ( bucket_id = 'menu-photos' );

-- ============================================================
-- Selesai. Setelah ini, buka menu.html > Tambah/Edit Menu > klik
-- kotak foto untuk upload gambar dari galeri/kamera HP.
-- ============================================================
