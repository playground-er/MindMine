# Handoff — MindMine

Ringkasan untuk dibawa ke Claude Code. Baca `docs/PRD.md` dan `docs/DESIGN-SPEC.md` untuk detail penuh.

---

## Apa yang dibangun

Papan ide visual untuk tim internal 5–20 orang. Model mental dari Milanote (kanvas bebas, kartu bertipe, board bersarang), lapisan visual dari Notion (tenang, rapi, minim dekorasi).

Bukan produk untuk dijual. Satu tim, semua anggota setara, tanpa onboarding, tanpa billing.

## Keputusan yang sudah dikunci

**Visual** — bahasa Craft: krem hangat, permukaan bertingkat, icon line-art:

- **Empat tingkat permukaan**, ini yang paling penting: `--canvas #F5F1E9` (papan) → `--surface #FFFDF7` (kartu) → `--surface-inset #F4F1EA` (blok di dalam kartu) → `--surface-raised #FFFFFF` (blok di dalam blok). Berhenti di lapis ketiga.
- **Kartu punya shadow.** Dua lapis, opacity sangat rendah, basis cokelat `rgba(60,48,30,…)` bukan abu — abu di atas krem terbaca seperti noda. Blok inset **tidak** punya shadow, dia turun ke dalam.
- **Serif hanya ≥26px** — board title dan empty state saja. Judul kartu pakai **sans 15px/600**. Ini koreksi dari revisi sebelumnya yang salah memakai serif di 17px.
- **Icon line-art stroke 1.5px, tanpa fill, monokrom.** Lucide dengan strokeWidth di-override ke 1.5. Tidak boleh icon ber-fill atau berbackground warna — pembeda utama dari Milanote.
- Radius: kartu 10px, blok inset 7px. Aturan: radius anak selalu lebih kecil dari induk.
- Dot grid tetap ada, `#E0DBD2`, spacing 24px, skala ikut zoom.
- Accent cuma strip 2px di kiri kartu. Nilai `ink` diverifikasi lolos AA di ketiga permukaan — jangan dicerahkan.
- State selected pakai ring saja, **tidak** mengubah background kartu (background berwarna merusak kontras blok inset di dalamnya).
- Tidak ada toolbar permanen di kartu. Menu ⋯ muncul on-hover.
- Tanpa setting/preference toggle apa pun. Termasuk dark mode — ikuti `prefers-color-scheme`.

**Kolaborasi**:
- **Yjs (CRDT) untuk isi teks** note dan todo. Bukan last-write-wins — di tim 15 orang, LWW berarti orang kehilangan tulisannya.
- **Last-write-wins untuk posisi/ukuran/z-index.** Konflik di situ terlihat dan gampang dibetulkan; CRDT untuk koordinat adalah biaya tanpa manfaat.
- **Undo per-user, bukan global.** ⌘Z membatalkan aksi user itu sendiri. Ini mahal diperbaiki belakangan.
- **Tidak ada lock kartu.** Dengan CRDT, lock tidak dibutuhkan dan justru terasa seperti bug.
- **Presence cap 8 cursor**, sisanya di avatar stack. Broadcast channel, tidak pernah masuk database.
- **Tidak ada role dan permission.** Semua anggota setara. Yang menggantikan: attribution + soft delete 30 hari.

**Persistence** — semua otomatis, tidak ada tombol save:
- Ketik → Yjs lokal seketika, broadcast ~50ms, flush ke Postgres setelah 2 detik idle
- Drag → optimistis lokal, broadcast throttled 60ms, tulis ke DB sekali saat pointer dilepas
- Offline → Yjs persist di IndexedDB, merge otomatis saat online
- Tidak disimpan: scroll/zoom (localStorage), presence, seleksi

## Stack

Vite + React 18 + TypeScript + Tailwind. Supabase (Postgres, Realtime, Storage, Auth magic link). Yjs + y-indexeddb + y-protocols. Zustand untuk canvas state, TanStack Query untuk server state. Drag pakai pointer events + `transform: translate3d`, tanpa library. Deploy ke Vercel.

RLS: satu policy untuk semua tabel, `EXISTS (SELECT 1 FROM member WHERE member.id = auth.uid())`. Anggota ditambah lewat SQL editor, bukan UI invite.

## Skema

```sql
member  (id, email, name, avatar_url, created_at)
board   (id, parent_card_id, title, created_at, created_by, updated_at)
card    (id, board_id, type, x, y, w, h, z, content jsonb, ydoc bytea,
         accent, created_by, updated_by, created_at, updated_at, deleted_at)
comment (id, card_id, author_id, body, created_at, resolved_at)
```

`ydoc` menyimpan state Yjs; `content` menyimpan versi plain untuk search dan list view, di-update dari Yjs saat dokumen settle. Duplikasi ini disengaja.

`deleted_at` = soft delete 30 hari. Ini yang bikin "tanpa permission" aman.

Nesting = kartu bertipe `board` yang menyimpan `target_board_id` di `content`.

## Urutan build

1. Auth + skema + board kosong yang bisa pan/zoom
2. Note card: create, drag, delete, persist (belum kolaboratif)
3. Yjs untuk isi note + presence cursor + avatar stack
4. **Viewport culling + memoization** — sebelum menambah tipe kartu
5. Todo, image, link card
6. Board card + nesting + breadcrumb
7. Komentar
8. ⌘K palette + search
9. List view
10. Polish state + transisi

**Tahap 3–4 adalah taruhan sebenarnya.** Ujinya: buka board yang sama di 5 tab, ketik bersamaan di kartu yang sama, gerakkan cursor. Kalau masih 60fps dan tidak ada teks hilang, sisanya tinggal eksekusi.

Tahap 4 sengaja sebelum penambahan fitur. Optimasi render yang ditunda sampai akhir hampir selalu berarti menulis ulang cara kartu di-render.

## Prompt awal untuk Claude Code

> Baca `docs/PRD.md` dan `docs/DESIGN-SPEC.md`. Bangun tahap 1 dari build order: setup Vite + React + TS + Tailwind, konfigurasi token warna/typography/spacing dari design spec sebagai CSS custom properties dan Tailwind theme extension, termasuk empat tingkat permukaan di bagian 2, load Instrument Serif + Inter dari Google Fonts, dan setup Lucide dengan strokeWidth 1.5 global, setup klien Supabase dengan skema di PRD bagian 5 termasuk RLS policy di bagian 11, lalu buat kanvas kosong yang bisa di-pan (space+drag dan two-finger scroll) dan di-zoom (⌘+scroll, batas 25%–200%) dengan zoom indicator di pojok kanan bawah sesuai spec bagian 7.
>
> Jangan buat kartu dulu. Selesaikan fondasi kanvas sampai terasa mulus di 60fps sebelum lanjut.

## Yang perlu dijaga saat build

Produk ini gampang membengkak, dan makin gampang di tim besar karena tiap orang punya satu permintaan kecil. Empat penahan:

1. Tidak ada fitur yang butuh setting — kalau butuh toggle, keputusannya belum diambil
2. Tidak ada tipe kartu ke-6 sebelum 5 yang ada terpakai rutin
3. Tidak ada role/permission selama tim masih satu dan saling kenal — tandanya butuh: ada yang tidak boleh melihat sesuatu, atau ada anggota yang tidak dikenal langsung
4. Tidak ada notifikasi — begitu masuk, butuh preference untuk mematikannya, melanggar aturan 1
