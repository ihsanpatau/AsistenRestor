# Ringkasan Perbaikan

File yang diubah/ditambahkan (letakkan di folder yang sama, timpa file lama):
- `menu.html`
- `orders.html`
- `supabase.js`
- `supabase_storage_setup.sql` (BARU — wajib dijalankan sekali)

## ⚠️ LANGKAH WAJIB SEBELUM DIPAKAI
Buka **Supabase Dashboard → SQL Editor** untuk project kamu (`rjxhijozmznqvkxqbywr`),
lalu jalankan seluruh isi file **`supabase_storage_setup.sql`**. Ini membuat bucket
storage `menu-photos` beserta izin aksesnya. Tanpa langkah ini, upload foto menu akan
gagal dengan pesan error yang jelas (bucket belum ada).

## 1. Menu → Upload Foto Langsung (bukan URL)
- Field "URL Foto" diganti kotak upload. Klik kotak foto di form Tambah/Edit Menu untuk
  pilih gambar dari galeri atau kamera HP.
- Foto langsung diupload ke Supabase Storage saat "Simpan Menu" ditekan, lalu URL
  publiknya otomatis tersimpan — tidak perlu lagi upload manual ke imgbb.com.
- Ada preview foto, tombol "Hapus Foto", validasi tipe file (harus gambar) dan ukuran
  maksimal 3MB. Saat foto diganti/dihapus, foto lama otomatis dibersihkan dari storage.

## 2. Pesanan Masuk → Disederhanakan jadi 2 Tahap
- Tampilan kanban & filter sekarang hanya: **🛎️ Pesanan Masuk** dan **🎉 Pesanan Selesai**
  (plus tab terpisah "❌ Dibatal" untuk pesanan yang dibatalkan).
- Semua pesanan baru (menunggu, sudah dibayar, sedang dimasak, dll) otomatis masuk kolom
  "Pesanan Masuk". Begitu dapur klik **"✅ Konfirmasi Selesai"**, pesanan langsung pindah
  ke kolom "Pesanan Selesai" — tidak perlu lagi klik beberapa tahap (dikonfirmasi → dimasak
  → siap → selesai).
- Tombol "Batalkan" tetap tersedia selama pesanan masih di tahap "Masuk".
- Data status lama di database (`pending`, `confirmed`, `preparing`, `ready`, `completed`,
  `cancelled`) tidak diubah strukturnya — hanya ditampilkan lebih sederhana di halaman ini,
  jadi tidak ada migrasi data yang diperlukan dan halaman lain (dashboard, laporan) tetap
  jalan normal.

## 3. Kategori Menu → Tidak Lagi Kosong/Template Kosong
- Saat restoran belum punya kategori sama sekali, sistem otomatis mengisi 5 kategori
  default: Makanan Utama, Minuman, Cemilan, Dessert, Paket Hemat — supaya dropdown
  kategori tidak kosong lagi.
- Modal "Kelola Kategori" sekarang bisa **Edit** (nama & ikon), bukan cuma Tambah/Hapus.
- Perbaikan kecil: pesan error dari Supabase kini ditampilkan (misalnya kalau nama
  kategori sudah dipakai), bukan cuma "Gagal tambah kategori".

## Catatan
- Semua perubahan hanya menyentuh 3 file di atas + 1 file SQL baru. File lain
  (dashboard.html, tables.html, transactions.html, settings.html, menu-pelanggan.html,
  dll) tidak diubah dan tetap berjalan seperti biasa.
