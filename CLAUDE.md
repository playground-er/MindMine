# MindMine

Papan ide visual untuk tim internal 5–20 orang. Model mental Milanote (kanvas bebas, kartu bertipe, board bersarang), bahasa visual Craft (krem hangat, permukaan bertingkat, icon line-art).

Internal tool. Bukan produk untuk dijual — tidak ada onboarding, billing, atau sharing publik.

## Dokumen wajib baca

Sebelum menulis kode apa pun di sesi baru:

- `docs/PRD.md` — model data, flow, interaction, arsitektur realtime
- `docs/DESIGN-SPEC.md` — token, typography, permukaan, komponen
- `docs/HANDOFF.md` — ringkasan keputusan + build order

Kalau ada konflik antara instruksi di chat dan dokumen ini, tanyakan. Jangan diam-diam menyimpang dari spec.

## Stack

- Vite + React 18 + TypeScript
- Tailwind (token dari design spec sebagai CSS custom properties + theme extension)
- Supabase: Postgres, Realtime, Storage, Auth (magic link)
- Yjs + y-indexeddb + y-protocols untuk kolaborasi teks
- Zustand (canvas state) + TanStack Query (server state)
- Lucide icons, strokeWidth di-override global ke 1.5
- Deploy: Vercel

## Aturan yang tidak boleh dilanggar

**Arsitektur**

1. **CRDT untuk isi teks, last-write-wins untuk posisi.** Yjs menangani note dan todo. Posisi/ukuran/z-index pakai LWW — konflik di situ terlihat dan gampang dibetulkan; CRDT untuk koordinat adalah biaya tanpa manfaat.
2. **Undo per-user, bukan global.** ⌘Z membatalkan aksi user itu sendiri. Ini mahal diperbaiki belakangan.
3. **Presence tidak pernah masuk database.** Broadcast channel saja. Cap 8 cursor ditampilkan.
4. **Tidak ada lock kartu.** Dengan CRDT, lock tidak dibutuhkan dan terasa seperti bug.
5. **Soft delete.** `deleted_at`, 30 hari. Ini yang bikin "tanpa permission" aman.
6. **Tidak ada role/permission.** Semua anggota setara. RLS satu policy untuk semua tabel.
7. **Viewport culling + memoization wajib ada sebelum menambah tipe kartu.** Bukan optimasi belakangan.

**Visual**

8. **Empat tingkat permukaan**: `--canvas` → `--surface` → `--surface-inset` → `--surface-raised`. Berhenti di lapis ketiga.
9. **Kartu punya shadow dua lapis**, basis cokelat `rgba(60,48,30,…)` bukan abu. Blok inset tidak punya shadow.
10. **Serif hanya ≥26px.** Board title dan empty state. Judul kartu pakai sans 15px/600.
11. **Icon line-art stroke 1.5px, tanpa fill, monokrom.** Tidak boleh icon ber-fill atau berbackground warna.
12. **Radius anak selalu lebih kecil dari induk.** Kartu 10px, inset 7px.
13. **Nilai accent `ink` sudah diverifikasi lolos WCAG AA di tiga permukaan.** Jangan dicerahkan tanpa mengecek ulang.
14. **State selected pakai ring saja**, tidak mengubah background kartu.
15. **Dot grid**: CSS `background-image`, `background-size` dikalikan zoom, dot size clamp 0.6–1.4px.

**Penahan scope**

16. Tidak ada fitur yang butuh setting. Kalau butuh toggle, keputusannya belum diambil.
17. Tidak ada tipe kartu ke-6 sebelum 5 yang ada terpakai rutin.
18. Tidak ada notifikasi.
19. Tidak ada dark mode toggle manual. Ikuti `prefers-color-scheme`.

## Build order

Kerjakan berurutan. Jangan lompat.

1. Auth + skema DB + kanvas kosong yang bisa pan/zoom + dot grid
2. Note card: create, drag, delete, persist (belum kolaboratif)
3. Yjs untuk isi note + presence cursor + avatar stack
4. **Viewport culling + memoization**
5. Todo, image, link card
6. Board card + nesting + breadcrumb
7. Komentar
8. ⌘K palette + search
9. List view
10. Polish state + transisi

Tahap 3–4 adalah taruhan teknis. Uji: buka board sama di 5 tab, ketik bersamaan di kartu yang sama, gerakkan cursor. Harus tetap 60fps tanpa teks hilang.

## Konvensi kode

- Komponen: PascalCase, satu komponen per file
- Hooks: `use` prefix, di `src/hooks/`
- Tipe: di `src/types/`, bukan inline kecuali dipakai sekali
- Tidak ada `any`. Kalau terpaksa, `unknown` + type guard.
- Tailwind untuk styling. CSS module hanya kalau butuh selector yang tidak bisa dicapai Tailwind.
- Nama variabel dan komentar dalam bahasa Inggris. Dokumen boleh Indonesia.

## Perintah

```bash
npm run dev        # dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

Jalankan `npm run typecheck` sebelum menyatakan sebuah tahap selesai.
