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

  // Daftar akun baru (email/password)
  async register(email, password) {
    const { data, error } = await db.auth.signUp({ email, password });
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

  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  const toast = document.createElement("div");
  toast.className = "toast toast-" + (type || "info");
  toast.innerHTML = `<span>${ icons[type] || "ℹ️" }</span><span>${message}</span>`;
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
