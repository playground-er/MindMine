# Setup — langkah manual

Yang harus dikerjakan sendiri karena butuh akses ke akun kamu.

---

## 1. Bikin repo GitHub

1. Buka github.com → **New repository**
2. Nama: `mindmine`
3. **Private** (ini internal tool)
4. Jangan centang "Add a README" — sudah ada di folder ini
5. **Create repository**

Jangan tutup halaman setelah dibuat; perintahnya muncul di situ.

## 2. Push folder ini ke repo

Download folder `mindmine`, lalu dari dalamnya:

```bash
git init
git add .
git commit -m "Initial: docs, tokens, schema"
git branch -M main
git remote add origin https://github.com/USERNAME/mindmine.git
git push -u origin main
```

Ganti `USERNAME` dengan username GitHub kamu.

**Cek sebelum push**: `git status` tidak boleh menampilkan `.env.local`. Kalau muncul, berarti `.gitignore` tidak kebaca — hentikan dan perbaiki dulu.

## 3. Bikin project Supabase

1. supabase.com → **New project**
2. Nama: `mindmine`
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
cd mindmine
claude
```

Claude Code otomatis baca `CLAUDE.md`. Lalu kirim prompt Tahap 1 dari `docs/PROMPTS.md`.

## 8. Daftarkan anggota tim

Ini dilakukan **setelah** tahap 2 selesai (auth sudah jalan).

Tiap orang login sekali lewat magic link. Setelah itu:

1. Dashboard → **Authentication** → **Users** → copy UUID orang tersebut
2. **SQL Editor**:

```sql
insert into member (id, email, name)
values ('uuid-dari-langkah-1', 'orang@email.com', 'Nama Orang');
```

Sengaja tidak ada UI invite. Untuk tim internal yang jarang berubah, membangunnya adalah pekerjaan yang tidak terbayar.

## 9. Deploy (nanti, setelah tahap 4)

1. vercel.com → **Add New** → **Project** → import repo `mindmine`
2. Framework preset: **Vite** (terdeteksi otomatis)
3. **Environment Variables**: masukkan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`
4. **Deploy**

Setelah dapat URL Vercel, tambahkan ke Supabase → **Authentication** → **URL Configuration** → **Redirect URLs**, kalau tidak magic link akan gagal redirect.

---

## Urutan yang disarankan

Langkah 1–7 sekarang, lalu langsung Tahap 1. Langkah 8 setelah Tahap 2. Langkah 9 setelah Tahap 4 — tidak ada gunanya deploy sebelum performa terbukti.
