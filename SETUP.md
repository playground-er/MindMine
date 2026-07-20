# Setup — langkah manual

Yang harus dikerjakan sendiri karena butuh akses ke akun kamu.

---

## 1. Bikin repo GitHub — ✅ selesai

1. Buka github.com → **New repository**
2. Nama: `MindMine`
3. **Private** (ini internal tool)
4. Jangan centang "Add a README" — sudah ada di folder ini
5. **Create repository**

Jangan tutup halaman setelah dibuat; perintahnya muncul di situ.

## 2. Push folder ini ke repo — ✅ selesai

Repo: **https://github.com/playground-er/MindMine**

Dari dalam folder `MindMine`:

```bash
git init
git add .
git commit -m "Initial: docs, tokens, schema"
git branch -M main
git remote add origin https://github.com/playground-er/MindMine.git
git push -u origin main
```

**Cek sebelum push**: `git status` tidak boleh menampilkan `.env.local`. Kalau muncul, berarti `.gitignore` tidak kebaca — hentikan dan perbaiki dulu.

## 3. Bikin project Supabase

1. supabase.com → **New project**
2. Nama: `MindMine`
3. Database password: generate, **simpan di password manager**
4. Region: **Southeast Asia (Singapore)** — paling dekat, latensi realtime paling rendah
5. Tunggu ~2 menit sampai provisioning selesai

## 4. Jalankan migration

1. Di dashboard Supabase → **SQL Editor** → **New query**
2. Buka `supabase/migrations/0001_init.sql`, copy seluruh isinya
3. Paste, klik **Run**
4. Harus muncul "Success. No rows returned"

Kalau error, jangan lanjut — kirim pesan errornya ke Claude Code untuk diperbaiki.

## 5. Ambil kredensial

Dashboard Supabase → **Settings** → **API**:

- **Project URL** → ini `VITE_SUPABASE_URL`
- **Project API keys** → **anon public** → ini `VITE_SUPABASE_ANON_KEY`

Buat file `.env.local` di root proyek:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

**Key `service_role` jangan pernah disentuh.** Dia bypass RLS sepenuhnya. Anon key aman di browser karena RLS yang melindungi.

## 6. Aktifkan magic link

Dashboard → **Authentication** → **Providers** → **Email**:

- **Enable Email provider**: on
- **Confirm email**: off (internal tool, email sudah diverifikasi lewat magic link)

## 7. Buka Claude Code

```bash
cd MindMine
claude
```

Claude Code otomatis baca `CLAUDE.md`. Lalu kirim prompt Tahap 1 dari `docs/PROMPTS.md`.

## 8. Daftarkan anggota tim

Ini dilakukan **setelah** tahap 2 selesai (auth sudah jalan).

Sengaja tidak ada UI invite. Untuk tim internal yang jarang berubah, membangunnya adalah pekerjaan yang tidak terbayar. Konsekuensinya: `member` diisi lewat SQL, dan baris di `auth.users` harus ada lebih dulu (`member.id` mereferensikannya).

### 8a. Anggota pertama — dirimu sendiri

Instance kosong tidak punya siapa-siapa, jadi bootstrap-nya lewat dashboard. **Tidak perlu login dulu.**

1. Dashboard → **Authentication** → **Users** → **Add user** → **Create new user**
2. Isi email, centang **Auto Confirm User**
3. **SQL Editor**:

```sql
insert into member (id, email, name)
select id, email, 'Nama Kamu'
from auth.users
where email = 'email@kamu.com';
```

Setelah itu buka aplikasi, masukkan email yang sama, dan magic link langsung membawamu ke kanvas.

Password yang kamu isi di langkah 2 tidak dipakai — aplikasi hanya punya jalur magic link. Itu cuma cara tercepat membuat baris `auth.users`.

### 8b. Anggota berikutnya

Rekan tim akan login sendiri, jadi tidak perlu dibuatkan manual:

1. Minta mereka buka aplikasi dan login sekali lewat magic link
2. Mereka akan lihat layar "Belum terdaftar" — itu wajar
3. Jalankan SQL yang sama seperti 8a, ganti email dan namanya
4. Minta mereka reload

SQL di atas mencari UUID-nya sendiri lewat email, jadi tidak ada UUID yang perlu dipindah tangan dari dashboard.

## 9. Deploy (nanti, setelah tahap 4)

1. vercel.com → **Add New** → **Project** → import repo `MindMine`
2. Framework preset: **Vite** (terdeteksi otomatis)
3. **Environment Variables**: masukkan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`
4. **Deploy**

Setelah dapat URL Vercel, tambahkan ke Supabase → **Authentication** → **URL Configuration** → **Redirect URLs**, kalau tidak magic link akan gagal redirect.

---

## Urutan yang disarankan

Langkah 1–7 sekarang, lalu langsung Tahap 1. Langkah 8 setelah Tahap 2. Langkah 9 setelah Tahap 4 — tidak ada gunanya deploy sebelum performa terbukti.
