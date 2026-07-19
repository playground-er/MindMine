# PRD — MindMine

Visual idea board untuk tim internal. Milanote's model, Craft's calm.

---

## 1. Problem

Milanote punya model mental yang benar untuk ideation bersama: kanvas bebas, kartu heterogen, board bersarang. Yang bikin nggak nyaman dipakai lama adalah lapisan visualnya — skeuomorphic paper, shadow tebal, chrome permanen di tiap kartu, dan warna yang saturasinya tinggi. Untuk sesi brainstorm 2 jam, itu melelahkan.

Produk ini mengambil model Milanote dan mengganti seluruh lapisan presentasinya dengan bahasa visual bertipe Notion: tenang, rapi, hampir tanpa dekorasi, hierarki dibangun dari spacing dan typography — bukan dari border dan shadow.

**Bukan** produk untuk dijual. Internal tool untuk satu tim, tanpa onboarding, tanpa billing, tanpa sharing publik.

## 2. Users

Satu tim, 5–20 orang, semua setara — semua bisa mengedit semua board. Tidak ada role, tidak ada permission.

Ini keputusan sadar dan bukan sekadar penundaan. Permission model punya biaya yang tidak kelihatan di awal: setiap fitur baru harus menjawab "siapa yang boleh melakukan ini," setiap query harus difilter, setiap state kosong punya dua versi. Untuk tim internal yang saling kenal, biaya itu tidak terbayar. Norma sosial lebih murah daripada kode.

Yang menggantikan permission: **attribution dan reversibility**. Setiap kartu menyimpan siapa yang membuat dan terakhir mengubah, dan setiap penghapusan bisa dibatalkan. Kalau ada yang salah hapus, jelas siapa dan gampang dibalikin — itu cukup untuk tim yang saling percaya.

Dua tipe pengguna yang perlu dilayani, bukan sebagai role tapi sebagai cara pakai:

| | |
|---|---|
| Visual thinker | Masuk lewat spatial arrangement, moodboard, sketsa. Butuh kanvas yang nggak melawan saat mikir cepat. |
| Structural thinker | Masuk lewat list, spec, link, referensi. Butuh isi kartu yang bisa dibaca dan dicari. |

Implikasi desain: dua mode konsumsi untuk data yang sama. Spatial (canvas) dan linear (list/outline view). Ini pembeda struktural terbesar dari Milanote, yang cuma punya spatial — dan makin penting di tim besar, karena makin banyak orang makin besar kemungkinan sebagian dari mereka tidak berpikir secara spasial.

## 3. Skala dan konsekuensinya

Naik dari 2 ke 20 orang mengubah beberapa keputusan arsitektur secara fundamental. Dicatat eksplisit supaya tidak ada yang menyalin pola dari versi 2-user:

**Konflik edit teks butuh CRDT.** Dengan 2 orang, dua orang mengedit note yang sama itu langka. Dengan 15 orang di satu board saat workshop, itu kejadian rutin — dan last-write-wins berarti seseorang kehilangan tulisannya tanpa tahu. Pakai Yjs untuk isi teks note dan todo.

Posisi, ukuran, dan z-index kartu **tetap last-write-wins**. Konflik di situ terlihat langsung di layar dan gampang dibetulkan dengan drag ulang. Memakai CRDT untuk koordinat adalah biaya tanpa manfaat.

**Presence perlu dibatasi.** 20 cursor di satu layar jadi kacau. Tampilkan maksimal 8 cursor (prioritas: yang paling dekat viewport user), sisanya cuma muncul di avatar stack header sebagai "+N".

**Komentar naik ke v1.** Di 2 orang, feedback cukup lewat ngomong langsung. Di 15 orang lintas timezone, feedback asinkron adalah kebutuhan dasar — tanpa itu orang akan mengedit kartu orang lain untuk menyampaikan pendapat, dan itu merusak kepercayaan pada tool.

**Undo harus per-user, bukan global.** Ini sering salah dan mahal untuk diperbaiki belakangan. ⌘Z harus membatalkan aksi *user itu sendiri* yang terakhir, bukan aksi terakhir di board. Undo global di multiplayer berarti kamu bisa membatalkan pekerjaan orang lain tanpa sengaja.

## 4. Goals

**In scope (v1)**
- Kanvas infinite dengan pan + zoom
- 5 tipe kartu: note, todo, image, link, board
- Board bersarang tanpa batas kedalaman
- Realtime sync multi-user + presence cursor (cap 8)
- Komentar per kartu
- List view sebagai tampilan alternatif dari board yang sama
- Command palette (⌘K) sebagai jalur utama semua aksi
- Attribution (siapa membuat/mengubah) di setiap kartu

**Out of scope (v1)**
- Role dan permission
- Multiple workspace atau tim terpisah
- Notifikasi (email/push)
- Version history
- Template gallery
- Mobile editing (view-only responsive sudah cukup)
- Export ke PDF/PNG
- Sharing ke luar tim

**Explicitly rejected**
- Freehand drawing. Kalau ini jadi kebutuhan, tldraw lebih baik daripada bikin sendiri.
- AI features di v1. Tambah nanti kalau pola pakainya sudah kelihatan, jangan tebak di depan.

## 5. Core model

```
member
  id, email, name, avatar_url, created_at

board
  id, parent_card_id, title, created_at, created_by, updated_at

card
  id, board_id, type, x, y, w, h, z,
  content jsonb, ydoc bytea, accent,
  created_by, updated_by, created_at, updated_at, deleted_at

comment
  id, card_id, author_id, body, created_at, resolved_at

presence   (ephemeral, tidak dipersist)
  member_id, board_id, cursor_x, cursor_y, selection[]
```

**Nesting** = kartu bertipe `board` yang menyimpan `target_board_id` di `content`. Board anak menyimpan `parent_card_id` balik ke kartu itu, supaya breadcrumb bisa dibangun tanpa query rekursif ke atas.

**`ydoc`** menyimpan state Yjs untuk kartu yang isinya teks kolaboratif (note, todo). `content` tetap menyimpan versi plain untuk search dan list view — di-update dari Yjs setiap kali dokumen settle. Duplikasi ini disengaja: search di dalam CRDT binary itu mahal, dan list view tidak butuh resolusi karakter-per-karakter.

**`deleted_at`** — soft delete. Kartu yang dihapus disembunyikan tapi tidak hilang selama 30 hari. Ini yang membuat "tanpa permission" aman: kesalahan bisa dibalikin.

## 6. Persistence — bagaimana data disimpan

Semua otomatis. Tidak ada tombol save di mana pun, dan itu keputusan yang disengaja — begitu ada tombol save, user harus memikirkan apakah kerjaannya sudah tersimpan, dan itu beban kognitif yang tidak perlu di tool ideation.

**Saat mengetik di kartu**: perubahan masuk ke Yjs doc lokal seketika, disiarkan ke user lain via websocket dalam ~50ms, dan di-flush ke Postgres setelah 2 detik idle (debounce). Kalau user menutup tab sebelum debounce selesai, `beforeunload` memaksa flush terakhir.

**Saat drag kartu**: posisi di-update optimistis di lokal, dikirim sebagai broadcast throttled 60ms selama drag berlangsung (supaya user lain lihat gerakannya, bukan lompatan), dan baru ditulis ke database sekali saat pointer dilepas.

**Saat offline**: semua edit tetap masuk ke Yjs doc lokal yang dipersist di IndexedDB. Saat koneksi balik, Yjs melakukan merge otomatis — ini keuntungan CRDT yang tidak didapat dari last-write-wins. Banner tipis di header memberi tahu status, tapi UI tidak pernah diblokir.

**Yang tidak disimpan**: posisi scroll dan zoom (localStorage, per-user), presence cursor (broadcast saja, tidak pernah menyentuh database), dan state seleksi.

**Backup**: Supabase punya point-in-time recovery di paid tier. Untuk tim internal, itu sudah cukup dan tidak perlu bikin sendiri.

**content per tipe**

```
note   { text: string }              // markdown subset
todo   { items: [{id, text, done}] }
image  { url, alt, natural_w, natural_h }
link   { url, title, favicon, og_image }
board  { target_board_id }
```

Alasan `content` disimpan sebagai jsonb dan bukan tabel per tipe: volume kecil, dan tipe kartu masih mungkin berubah. Normalisasi di sini biayanya lebih besar dari manfaatnya. Kalau nanti jumlah kartu lewat ~50k, tinjau ulang — sampai situ jsonb dengan GIN index masih baik-baik saja.

## 7. Interaction model

### Canvas
- Pan: space+drag, atau drag di area kosong, atau two-finger scroll
- Zoom: ⌘+scroll, dibatasi 25%–200%. Di bawah 50%, kartu masuk mode ringkas (judul saja).
- Select: klik. Multi-select: shift-klik atau drag marquee.
- Move: drag. Snap ke grid 8px, bisa dimatikan dengan tahan ⌥.
- Delete: ⌫ dengan undo toast 5 detik (soft delete, bisa dipulihkan sampai 30 hari)
- Undo: ⌘Z, **per-user**. Membatalkan aksi user itu sendiri, bukan aksi terakhir di board.

### Membuat kartu
Double-click di kanvas kosong → kartu note langsung dalam mode edit. Ini jalur tercepat dan harus tetap yang paling cepat.

Semua tipe lain lewat ⌘K, atau paste:
- Paste URL → auto jadi link card dengan OG fetch
- Paste image → upload ke Supabase storage, jadi image card
- Paste teks panjang → note card

Tidak ada toolbar tipe-kartu yang permanen di layar. Itu keputusan yang disengaja — toolbar mengambil ruang dan menambah noise visual di setiap sesi, padahal cuma dipakai di awal.

### List view
Toggle di header board. Menampilkan kartu yang sama sebagai outline vertikal, urut berdasarkan posisi Y lalu X (jadi urutan visual atas-ke-bawah tetap terasa masuk akal). Todo card menampilkan progress. Board card bisa di-expand inline.

Edit di list view menulis ke record yang sama. Bukan view terpisah, bukan salinan.

### Komentar
Klik icon komentar di kartu (muncul on-hover) atau ⌘⇧M saat kartu terpilih. Panel geser dari kanan, 320px, tidak menutupi kanvas — kanvas bergeser, tidak tertimpa.

Kartu yang punya komentar belum selesai menampilkan dot kecil di pojok kanan atas. Komentar yang sudah di-resolve disembunyikan tapi bisa dibuka lagi.

Tanpa mention dan tanpa notifikasi di v1. Sengaja: begitu ada mention, orang berharap ada notifikasi, dan begitu ada notifikasi butuh preference untuk mematikannya — itu rantai yang panjang. Tim internal biasanya sudah punya Slack untuk urusan itu.

### Realtime
Dua lapis, dan penting untuk tidak mencampurnya:

**Lapis CRDT (isi teks)** — Yjs, di-sync lewat `y-websocket` atau Supabase Realtime broadcast sebagai transport. Menangani note dan todo. Ini yang membuat 15 orang bisa mengetik bersamaan tanpa ada yang kehilangan tulisan.

**Lapis database (sisanya)** — Supabase Realtime `postgres_changes` untuk posisi, ukuran, z-index, pembuatan/penghapusan kartu, dan komentar. Last-write-wins, dan itu cukup: konflik posisi terlihat langsung dan gampang dibetulkan.

**Presence** — channel `broadcast` terpisah, tidak pernah menyentuh database. Cap 8 cursor yang ditampilkan; sisanya hanya muncul di avatar stack header. Cursor throttled 60ms.

Yang sengaja dihapus dari versi sebelumnya: **lock kartu saat orang lain mengedit**. Dengan CRDT, lock tidak dibutuhkan lagi dan justru merugikan — di sesi workshop, memblokir orang dari kartu yang sedang dibuka orang lain akan terasa seperti bug. Yang tetap ada cuma indikator visual siapa yang sedang di kartu itu.

## 8. Flows

**Buka aplikasi** → board terakhir yang dibuka, di posisi scroll dan zoom terakhir. State ini disimpan di localStorage, bukan di server.

**Masuk ke board bersarang** → double-click kartu board. Transisi: kartu membesar mengisi viewport (scale + fade, 240ms). Keluar dengan ⌘[ atau klik breadcrumb.

**Cari** → ⌘K, ketik. Mencari judul board dan isi kartu di semua board. Hasil menampilkan jalur breadcrumb-nya, karena tanpa itu user tidak tahu kartu yang ketemu ada di mana.

## 9. States yang wajib ada

Sering dilewat, dan ini justru tempat produk terasa murah kalau tidak ditangani:

- **Board kosong** — bukan ilustrasi besar. Satu baris teks abu di tengah: "Double-click di mana saja untuk mulai." Hilang saat kartu pertama dibuat.
- **Image loading** — placeholder abu dengan aspect ratio yang sudah benar dari `natural_w/h`, supaya layout tidak melompat.
- **Link fetch gagal** — tetap tampilkan kartu dengan URL mentah dan hostname. Jangan kartu error.
- **Offline** — banner tipis di atas, edit lokal tetap jalan, queue disinkronkan saat online. Jangan blokir UI.
- **Orang lain sedang mengedit** — outline accent + avatar stack di pojok kartu. Kalau lebih dari 3 orang, tampilkan 2 avatar + "+N".
- **Board dihapus saat orang lain sedang di dalamnya** — lempar ke parent dengan toast, jangan layar putih.
- **Board yatim** — kalau kartu board induknya dihapus, board anak jadi `parent_card_id = null` (FK-nya `on delete set null`, bukan cascade, supaya tidak ada subtree yang hilang). Board yatim muncul di ⌘K dengan label "Tidak tertaut" dan bisa di-link ulang.
- **Board ramai (>10 orang aktif)** — avatar stack header meluap jadi "+N" yang bisa diklik untuk daftar lengkap.
- **Kartu terhapus** — toast dengan tombol undo 5 detik. Setelah itu masih bisa dipulihkan lewat ⌘K → "Restore deleted".
- **Konflik CRDT saat balik online** — tidak ada UI khusus. Yjs merge otomatis. Ini justru alasan memakai CRDT.

## 10. Non-goals yang perlu dijaga

Produk ini gampang membengkak, dan makin gampang di tim besar karena tiap orang punya satu permintaan kecil. Empat aturan penahan:

1. **Tidak ada fitur yang butuh setting.** Kalau butuh preference toggle, berarti keputusannya belum diambil.
2. **Tidak ada tipe kartu ke-6 sebelum 5 yang ada terpakai semua secara rutin.**
3. **Tidak ada role dan permission selama tim masih satu dan saling kenal.** Kalau nanti benar-benar butuh, itu perubahan besar — bukan tambahan kecil. Tandanya: ada orang yang tidak boleh melihat sesuatu, atau ada yang tidak dikenal langsung oleh anggota lain.
4. **Tidak ada notifikasi.** Begitu masuk, butuh preference untuk mematikannya, dan itu melanggar aturan 1.

## 11. Tech

- Vite + React 18 + TypeScript
- Tailwind, token layer sendiri (lihat design spec)
- Supabase: Postgres, Realtime, Storage, Auth (magic link)
- **Yjs** + `y-indexeddb` (persist lokal) + `y-protocols` untuk awareness
- State: Zustand untuk canvas state, TanStack Query untuk server state
- Drag: pointer events + `transform: translate3d`, tanpa library. `react-rnd` hanya kalau resize handle jadi rumit.
- Deploy: Vercel

**RLS policy**: `EXISTS (SELECT 1 FROM member WHERE member.id = auth.uid())`. Satu aturan, berlaku sama untuk semua tabel. Tidak ada pembedaan per-role karena tidak ada role.

Anggota ditambahkan dengan memasukkan email ke tabel `member` — lewat SQL editor Supabase, bukan lewat UI. Untuk tim internal yang jarang berubah, membangun UI invite adalah pekerjaan yang tidak terbayar. Kalau ternyata anggota berganti tiap minggu, baru bikin.

**Performa di skala tim**: dengan 20 orang aktif dan 200+ kartu di satu board, render jadi masalah nyata. Dua hal yang wajib ada sejak awal — viewport culling (jangan render kartu di luar layar) dan `React.memo` per kartu dengan komparator yang hanya melihat field posisi/konten. Tanpa itu, tiap gerakan cursor orang lain memicu re-render seluruh kanvas.

## 12. Build order

Urutan ini disusun supaya tiap tahap menghasilkan sesuatu yang bisa dipakai, bukan supaya rapi di kertas.

1. Auth + skema DB + board kosong yang bisa di-pan/zoom
2. Note card: create, drag, delete, persist (belum kolaboratif)
3. Yjs untuk isi note + presence cursor + avatar stack
4. Viewport culling dan memoization — **sebelum** menambah tipe kartu
5. Tipe kartu sisanya (todo, image, link)
6. Board card + nesting + breadcrumb
7. Komentar
8. ⌘K command palette + search
9. List view
10. State polish (bagian 9) dan transisi

Tahap 3–4 adalah taruhan teknis sebenarnya. Ujinya: buka board yang sama di 5 tab browser, ketik bersamaan di kartu yang sama, dan gerakkan cursor. Kalau masih 60fps dan tidak ada teks yang hilang, sisanya tinggal eksekusi.

Tahap 4 sengaja diletakkan sebelum penambahan fitur, bukan sesudah. Optimasi render yang ditunda sampai akhir hampir selalu berarti menulis ulang cara kartu di-render — jauh lebih mahal daripada membangunnya benar sejak lima tipe kartu masih satu.
