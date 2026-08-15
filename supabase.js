// ============================================
// SUPABASE CLIENT + AUTH HELPER + UI UTILS
// Dipakai bersama di semua halaman RestoranKu
// ============================================
const { createClient } = supabase;
const db = createClient(
  "https://rjxhijozmznqvkxqbywr.supabase.co",
  "sb_publishable_v-FyoWoz05KpYt1gA1k96A_IZiQnpXB"
);

const Auth = {
  // Login email/password
  async login(email, password) {
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  // Daftar akun baru (email/password). `restoName` (opsional) disimpan di
  // user_metadata supaya bisa dipakai ensureRestaurant() untuk mengisi nama
  // restoran otomatis begitu user berhasil login pertama kali — perlu begini
  // karena kalau "Confirm email" aktif di project Supabase, signUp TIDAK
  // langsung memberi sesi login, jadi insert ke tabel restaurants tidak bisa
  // dilakukan di sini (bakal ditolak RLS karena belum authenticated).
  async register(email, password, restoName) {
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: restoName ? { data: { full_name: restoName } } : undefined,
    });
    if (error) throw error;
    return data;
  },

  // Login / daftar pakai akun Google (OAuth)
  async loginWithGoogle(redirectPage) {
    const redirectTo =
      window.location.origin +
      window.location.pathname.replace(/[^/]*$/, "") +
      (redirectPage || "dashboard.html");
    const { data, error } = await db.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) throw error;
    return data;
  },

  async logout() {
    await db.auth.signOut();
    window.location.href = "login.html";
  },

  async getUser() {
    const { data } = await db.auth.getUser();
    return data?.user || null;
  },

  // Wajib dipanggil di halaman yang butuh login. Redirect ke login.html jika belum login.
  async requireAuth() {
    const user = await this.getUser();
    if (!user) {
      window.location.href = "login.html";
      return null;
    }
    return user;
  },

  // Pastikan user (biasanya yang baru login via Google) sudah punya row restaurant.
  // Kalau belum ada, buat otomatis supaya tidak nyangkut di halaman kosong.
  async ensureRestaurant(user) {
    const { data: existing } = await db
      .from("restaurants")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) return existing;

    const rawName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email.split("@")[0];
    const name = rawName || "Restoran Baru";
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      Date.now().toString().slice(-4);

    const { data: created, error } = await db
      .from("restaurants")
      .insert({
        user_id: user.id,
        name,
        slug,
        email: user.email,
      })
      .select()
      .single();

    if (error) throw error;
    return created;
  },
};

// ============================================
// STORAGE HELPER (upload foto ke Supabase Storage)
// ============================================
const STORAGE_BUCKET = "menu-photos";

/** * Upload file foto menu ke Supabase Storage dan kembalikan public URL-nya. * @param {File} file * @param {string} restoId - dipakai sebagai folder supaya rapi & terpisah per restoran */
async function uploadMenuImage(file, restoId) {
  if (!file) return null;
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : "jpg";
  const filePath = `${restoId}/${Date.now()}-${Math.random() .toString(36) .slice(2, 8)}.${safeExt}`;

  const { error } = await db.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });

  if (error) {
    // Pesan lebih jelas kalau bucket belum dibuat di Supabase
    if (/bucket/i.test(error.message) && /not.*found/i.test(error.message)) {
      throw new Error(
        `Bucket storage "${STORAGE_BUCKET}" belum ada di Supabase. Buat dulu lewat SQL Editor (lihat supabase_storage_setup.sql).`
      );
    }
    throw error;
  }

  const { data: pub } = db.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  return pub.publicUrl;
}

/** * Hapus foto lama dari storage berdasarkan public URL-nya (best-effort, tidak melempar error). */
async function deleteMenuImage(publicUrl) {
  try {
    if (!publicUrl || !publicUrl.includes(`/${STORAGE_BUCKET}/`)) return;
    const path = publicUrl.split(`/${STORAGE_BUCKET}/`)[1];
    if (!path) return;
    await db.storage.from(STORAGE_BUCKET).remove([path]);
  } catch (e) {
    // Diamkan saja, penghapusan foto lama tidak kritikal
  }
}

/** * Upload BEBERAPA foto menu sekaligus (dipakai fitur multi-foto di menu.html). * @param {File[]} files * @param {string} restoId * @returns {Promise<string[]>} array public URL, urutan sama seperti input */
async function uploadMenuImages(files, restoId) {
  const list = Array.from(files || []);
  const urls = [];
  for (const file of list) {
    // Diupload berurutan (bukan Promise.all) supaya kalau salah satu gagal,
    // pesan error jelas menyebut foto keberapa yang bermasalah.
    urls.push(await uploadMenuImage(file, restoId));
  }
  return urls;
}

/** * Hapus BEBERAPA foto lama dari storage sekaligus (best-effort, tidak melempar error). */
async function deleteMenuImages(publicUrls) {
  const list = Array.from(publicUrls || []).filter(Boolean);
  await Promise.all(list.map((url) => deleteMenuImage(url)));
}

// Kategori default yang otomatis dibuat untuk restoran baru yang belum punya kategori sama sekali
const DEFAULT_MENU_CATEGORIES = [
  { name: "Makanan Utama", icon: "🍛", sort_order: 1 },
  { name: "Minuman", icon: "🥤", sort_order: 2 },
  { name: "Cemilan", icon: "🍟", sort_order: 3 },
  { name: "Dessert", icon: "🍰", sort_order: 4 },
  { name: "Paket Hemat", icon: "🎁", sort_order: 5 },
];

/** * Pastikan restoran punya minimal satu kategori. Kalau kosong, isi otomatis dengan kategori default * supaya dropdown kategori tidak kosong melompong untuk restoran baru. */
async function ensureDefaultCategories(restoId) {
  const { count, error: countErr } = await db
    .from("menu_categories")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restoId);

  if (countErr) return { seeded: false, error: countErr };
  if (count && count > 0) return { seeded: false, error: null };

  const rows = DEFAULT_MENU_CATEGORIES.map((c) => ({
    ...c,
    restaurant_id: restoId,
  }));
  const { error } = await db.from("menu_categories").insert(rows);
  return { seeded: !error, error: error || null };
}

// ============================================
// UI UTILS
// ============================================
function formatRupiah(num) {
  return "Rp " + Math.round(num || 0).toLocaleString("id-ID");
}
// Alias dipakai di beberapa halaman
function formatRp(num) {
  return formatRupiah(num);
}

function showToast(message, type) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const icons = {
    success:
      '<svg class="i" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.3 12.5l2.5 2.5L16 9.5"/></svg>',
    error:
      '<svg class="i" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
    info: '<svg class="i" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.2 9.2a5.8 5.8 0 0 1 11.6 0c0 4.8 1.9 5.8 1.9 5.8H4.3s1.9-1 1.9-5.8Z"/><path d="M10.2 18.6a1.9 1.9 0 0 0 3.6 0"/></svg>',
  };
  const toast = document.createElement("div");
  toast.className = "toast toast-" + (type || "info");
  toast.innerHTML = `<span style="display:flex">${ icons[type] || icons.info }</span><span>${message}</span>`;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function setLoading(btn, isLoading) {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Memproses...';
  } else {
    btn.disabled = false;
    if (btn.dataset.originalText) btn.innerHTML = btn.dataset.originalText;
  }
}

// ============================================
// APP SHELL: bottom sheet "Lainnya" + service worker
// ============================================
function toggleMoreSheet() {
  const el = document.getElementById("more-sheet-overlay");
  if (el) el.classList.toggle("active");
}
function closeMoreSheet(e) {
  if (e && e.target.id !== "more-sheet-overlay") return;
  const el = document.getElementById("more-sheet-overlay");
  if (el) el.classList.remove("active");
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
