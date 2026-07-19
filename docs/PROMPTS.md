# Prompt per tahap — Claude Code

Satu prompt per tahap. Kerjakan berurutan, jangan lompat. Setiap tahap punya **kriteria selesai** yang harus lulus sebelum lanjut — ini bukan formalitas, ini yang mencegah utang teknis menumpuk di fondasi.

Mulai sesi baru (`/clear`) untuk tiap tahap. Konteks yang menumpuk dari tahap sebelumnya bikin Claude Code makin sering menyimpang dari spec.

---

## Tahap 1 — Fondasi kanvas

> Baca `CLAUDE.md`, `docs/PRD.md`, dan `docs/DESIGN-SPEC.md` sebelum menulis kode.
>
> Setup proyek dan bangun fondasi kanvas:
>
> 1. Scaffold Vite + React 18 + TypeScript + Tailwind. Token sudah ada di `src/styles/tokens.css` dan `tailwind.config.ts` — pakai itu, jangan tulis ulang nilainya.
> 2. Load Instrument Serif + Inter dari Google Fonts di `index.html`. Inter dengan `font-feature-settings: "cv11", "ss01"`.
> 3. Setup klien Supabase di `src/lib/supabase.ts`, baca env dari `import.meta.env`.
> 4. Kanvas infinite: pan (space+drag, drag di area kosong, two-finger scroll) dan zoom (⌘+scroll, clamp 25%–200%). State kanvas di Zustand.
> 5. Dot grid sesuai spec bagian 7 — CSS `background-image`, `background-size` dikalikan zoom, dot size clamp 0.6–1.4px, fade di bawah 50% dan di atas 150%.
> 6. Zoom control pojok kanan bawah sesuai spec bagian 9.
> 7. Persist posisi scroll dan zoom ke localStorage, bukan ke server.
>
> Jangan buat kartu, auth flow, atau realtime. Fondasi dulu.
>
> **Kriteria selesai**: `npm run typecheck` bersih. Buka DevTools > Performance, pan terus-menerus 5 detik — tidak ada frame drop, dan tidak ada layout/paint di timeline (dot grid harus di-handle compositor).

---

## Tahap 2 — Note card

> Baca `CLAUDE.md` dan `docs/DESIGN-SPEC.md` bagian 8 (anatomi kartu).
>
> Bangun note card lengkap, belum kolaboratif:
>
> 1. Auth magic link. Halaman login minimal — satu input email, satu tombol. Setelah login, cek apakah user ada di tabel `member`; kalau tidak, tampilkan pesan bahwa akunnya belum didaftarkan.
> 2. Root board dibuat otomatis kalau belum ada board dengan `parent_card_id` null.
> 3. Note card: double-click kanvas kosong → kartu baru langsung mode edit.
> 4. Drag dengan pointer events + `transform: translate3d`. Snap 8px, matikan dengan tahan ⌥.
> 5. Resize lebar saja (note tingginya ikut konten).
> 6. Delete dengan ⌫ → soft delete (`deleted_at`) + toast undo 5 detik.
> 7. Semua state kartu dari spec bagian 8: default, hover, selected, dragging, editing.
> 8. Persist: optimistic lokal, tulis ke Postgres saat pointer dilepas (drag) atau 2 detik idle (teks).
>
> Ikuti anatomi kartu persis: strip accent 2px kiri, header dengan icon 18px + judul sans 15/600, body 13px, meta 11px. Shadow dua lapis. Tanpa border.
>
> **Kriteria selesai**: buat 20 kartu, drag-drag, refresh — semua posisi dan isi persis seperti sebelum refresh.

---

## Tahap 3 — Kolaborasi

> Baca `docs/PRD.md` bagian 7 (realtime) dan `CLAUDE.md` aturan 1–4.
>
> Tambahkan kolaborasi realtime:
>
> 1. Yjs untuk isi teks note. `y-indexeddb` untuk persist lokal, Supabase Realtime broadcast sebagai transport. Flush ke kolom `ydoc` setelah 2 detik idle; `content` jsonb di-update dengan versi plain untuk search.
> 2. `postgres_changes` untuk posisi, ukuran, z-index, create/delete. Last-write-wins.
> 3. Presence lewat broadcast channel — cursor dan selection. Tidak pernah masuk database. Throttle 60ms.
> 4. Cursor: warna deterministik dari hash user id ke palet 12 warna, terpisah dari palet accent. Label nama 1.5 detik lalu fade. Cap 8 cursor ditampilkan, prioritas terdekat viewport.
> 5. Avatar stack di header, maks 4 lalu `+N`, ring pakai `box-shadow` bukan `border`.
> 6. Indikator "sedang diedit" di kartu: ring dashed + avatar stack 16px. **Tanpa lock** — jangan blokir siapa pun dari kartu mana pun.
> 7. Undo per-user (⌘Z membatalkan aksi user sendiri, bukan aksi terakhir di board).
> 8. Banner offline tipis di header. Edit tetap jalan, queue disinkronkan saat online.
>
> **Kriteria selesai**: buka board yang sama di 5 tab browser. Ketik bersamaan di kartu yang sama — tidak ada teks hilang. Gerakkan cursor di semua tab — tetap 60fps. Matikan network di satu tab, ketik, nyalakan lagi — teks ter-merge tanpa konflik.

---

## Tahap 4 — Performa

> Sebelum menambah tipe kartu, optimalkan render. Ini bukan optimasi belakangan — menundanya berarti menulis ulang cara kartu di-render nanti.
>
> 1. Viewport culling: hanya render kartu yang berpotongan dengan viewport plus margin 200px. Pakai spatial index sederhana (grid buckets), bukan iterasi seluruh array tiap frame.
> 2. `React.memo` per kartu dengan komparator yang hanya melihat field yang mempengaruhi render — bukan seluruh objek kartu.
> 3. Pisahkan presence state dari card state di Zustand, dengan selector terpisah. Gerakan cursor orang lain tidak boleh memicu re-render kartu mana pun.
> 4. Batch update posisi saat drag pakai `requestAnimationFrame`, jangan set state tiap pointer event.
> 5. Di zoom < 50%, kartu masuk mode ringkas: judul saja, tanpa body dan meta.
>
> **Kriteria selesai**: generate 300 kartu dummy. Pan dan zoom tetap 60fps. Buka React DevTools Profiler, gerakkan cursor di tab lain — tidak ada kartu yang re-render.

---

## Tahap 5 — Tipe kartu sisanya

> Baca `docs/DESIGN-SPEC.md` bagian 8, khususnya sub-bagian blok inset.
>
> Tambahkan todo, image, dan link card.
>
> 1. **Todo**: daftar item di dalam **blok inset** (`--surface-inset`, radius 7px, tanpa shadow). Checkbox 16px sesuai spec. Item selesai: `--ink-muted` + line-through. Isi teks item pakai Yjs seperti note.
> 2. **Image**: paste atau drop → upload ke bucket `card-images` → kartu dengan aspect ratio benar dari `natural_w/h`. Placeholder saat loading supaya layout tidak melompat.
> 3. **Link**: paste URL → fetch OG metadata → kartu dengan favicon, title, hostname. Kalau fetch gagal, tetap tampilkan kartu dengan URL mentah — jangan kartu error.
> 4. Paste handler di kanvas: URL → link card, image → image card, teks panjang → note card.
>
> Blok inset boleh berisi blok L3 (`--surface-raised`). Berhenti di lapis ketiga.
>
> **Kriteria selesai**: keempat tipe kartu berdampingan di satu board, semua state benar, `npm run typecheck` bersih.

---

## Tahap 6 — Nesting

> 1. Board card: double-click → masuk ke board anak. Transisi 240ms, kartu scale mengisi viewport + cross-fade.
> 2. Breadcrumb di header. Segmen terakhir sans 15/600, sisanya `text-xs` secondary. Lebih dari 4 level → tengahnya jadi `…` yang bisa diklik.
> 3. Keluar dengan ⌘[ atau klik breadcrumb.
> 4. Board card menampilkan jumlah kartu di dalamnya.
> 5. Handle board dihapus saat orang lain sedang di dalamnya: lempar ke parent dengan toast.
>
> **Kriteria selesai**: nesting 4 level dalam, breadcrumb benar di tiap level, tidak ada query rekursif ke atas.

---

## Tahap 7 — Komentar

> 1. Panel 320px geser dari kanan. **Kanvas bergeser, tidak tertimpa** — kartu yang dikomentari harus tetap terlihat. Transisi 200ms.
> 2. Buka dengan icon komentar di kartu (on-hover) atau ⌘⇧M saat kartu terpilih.
> 3. Dot 6px di pojok kanan atas kartu yang punya komentar belum selesai.
> 4. Resolve menyembunyikan komentar, bisa dibuka lagi.
> 5. Tanpa mention, tanpa notifikasi.

---

## Tahap 8 — Command palette

> 1. ⌘K. Lebar 560px, center, radius 14px, `--shadow-float`, backdrop blur 4px.
> 2. Grup hasil: Actions, Cards, Boards.
> 3. Search isi kartu di semua board. Hasil menampilkan jalur breadcrumb — tanpa itu user tidak tahu kartu yang ketemu ada di mana.
> 4. Actions: buat kartu tiap tipe, restore deleted, toggle canvas/list.
> 5. Shortcut ditampilkan di sini dan di tooltip, bukan sebagai chip permanen di toolbar.

---

## Tahap 9 — List view

> 1. Toggle di header. Kartu yang sama sebagai outline vertikal, urut posisi Y lalu X.
> 2. Todo menampilkan progress. Board card bisa di-expand inline.
> 3. Edit di list view menulis ke record yang sama — bukan view terpisah, bukan salinan.

---

## Tahap 10 — Polish

> Kerjakan semua state di `docs/PRD.md` bagian 9, lalu semua transisi di `docs/DESIGN-SPEC.md` bagian 10.
>
> Terakhir, audit aksesibilitas: keyboard nav penuh (Tab antar kartu berdasarkan posisi, Enter edit, Esc keluar, arrow geser 8px, shift+arrow 1px), `aria-label` di tiap kartu, `role="application"` di kanvas, blok inset dibungkus `<section>` + `aria-label`, presence cursor `aria-hidden`.
