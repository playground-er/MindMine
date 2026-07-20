# Design Spec — MindMine

Craft's visual language, applied to a collaborative canvas.

> **Catatan revisi.** Versi ini mengganti seluruh lapisan visual dari Notion-style ke Craft-style. Yang **tidak** berubah: model data, flow, interaction model, arsitektur realtime — semuanya di PRD dan tetap berlaku.
>
> Revisi kedua memperbaiki tiga hal dari revisi pertama: (1) serif turun drastis — hanya untuk headline besar, judul kartu pakai sans bold; (2) kartu **punya shadow**, keputusan tanpa-shadow dibatalkan; (3) ditambahkan sistem **nested surface** — kemampuan menaruh blok di dalam kartu, yang sebelumnya tidak ada sama sekali dan merupakan lubang nyata di spec.

---

## 1. Prinsip

Lima aturan yang mengikat semua keputusan di bawah. Kalau ada konflik, urutan ini yang menang.

**1. Hangat, bukan netral.**
Craft membangun ketenangan dari kertas krem, bukan dari putih klinis. Setiap permukaan punya sedikit kuning-merah di dalamnya. Ini bukan sekadar preferensi rasa — background hangat menurunkan kontras cahaya biru dan terasa lebih nyaman untuk sesi panjang, yang persis konteks pemakaian tool ini.

**2. Serif hanya untuk headline besar.**
Serif dipakai di board title dan empty state — ukuran ≥26px, tempat di mana karakternya terbaca dan memberi suara. Judul kartu, label, dan segala teks di bawah 26px pakai **sans bold**.

Ini koreksi dari revisi pertama yang memakai serif di judul kartu 17px. Pada ukuran itu serif kehilangan karakternya dan cuma jadi terasa berbeda tanpa alasan. Referensi Craft juga memakai sans bold untuk judul kartu, dan serif hanya di headline halaman.

**3. Kedalaman lewat lapisan permukaan, bukan lewat garis.**
Hierarki di dalam kartu dibangun dengan menumpuk permukaan yang sedikit berbeda terangnya — kartu putih, blok inset abu di dalamnya, dan bila perlu blok putih lagi di dalam itu. Tiga lapis sudah cukup untuk semua kebutuhan. Ini yang membuat kartu bisa memuat struktur tanpa perlu border pemisah.

**4. Icon adalah garis, bukan bentuk.**
Line-art, stroke 1.5px, monokrom, tanpa fill. Ini pembeda visual terbesar dari Milanote, yang icon-nya berwarna dan padat. Icon yang di-fill menarik perhatian ke dirinya sendiri; icon garis menyatu dengan teks di sekitarnya.

**5. Ruang kosong adalah elemen desain.**
Referensi Craft punya jarak sangat lega antar elemen. Spacing di sini dinaikkan dari versi sebelumnya. Kanvas yang lapang terasa mengundang untuk diisi; kanvas padat terasa seperti pekerjaan yang tertunda.

---

## 2. Color

### Neutral — light

Empat tingkat permukaan, bukan dua. Ini penambahan terpenting di revisi ini.

```css
--canvas:        #F5F1E9;   /* L0 — papan */
--surface:       #FFFDF7;   /* L1 — kartu */
--surface-inset: #F4F1EA;   /* L2 — blok di dalam kartu */
--surface-raised:#FFFFFF;   /* L3 — blok di dalam blok */
--surface-hover: #FFFFFF;

--border:        #E8E3D9;
--border-strong: #D6D0C3;

--ink:           #26241F;   /* teks utama — cokelat sangat gelap, bukan hitam */
--ink-secondary: #6B6660;
--ink-tertiary:  #9A948B;
--ink-muted:     #C0B9AF;   /* placeholder, teks nonaktif */

--dot:           #E0DBD2;
```

**Tangga kontras antar lapisan**: L0→L1 = 1.108, L1→L2 = 1.109, L2→L3 = 1.128. Jaraknya sengaja dibuat hampir sama supaya tiap langkah kedalaman terasa setara. Kalau salah satu lompatan lebih besar, mata membacanya sebagai hierarki yang timpang.

Perhatikan L2 (`--surface-inset`) **lebih gelap** dari L1, tapi L3 (`--surface-raised`) lebih terang lagi dari L2. Ini pola yang sama dengan referensi Craft: blok inset terbaca sebagai lubang di dalam kartu, lalu isi di dalamnya naik lagi ke putih. Bukan tangga yang terus menggelap.

`--ink` di atas `--surface` = 15.24, di atas `--surface-inset` = 13.74. `--ink-secondary` = 5.59 / 5.04, lolos AA di kedua permukaan. `--ink-tertiary` = 2.96 / 2.67 — **hanya untuk teks ≥18px atau elemen non-esensial**, tidak pernah untuk body. `--ink-muted` = 1.91 / 1.72, hanya untuk teks yang memang sudah nonaktif (task selesai, placeholder).

### Neutral — dark

```css
--canvas:        #1A1917;   /* L0 */
--surface:       #232220;   /* L1 */
--surface-inset: #1E1D1B;   /* L2 — lebih gelap, seperti light mode */
--surface-raised:#2A2825;   /* L3 */
--surface-hover: #292724;

--border:        #322F2B;
--border-strong: #423E39;

--ink:           #EFEBE4;
--ink-secondary: #A8A199;
--ink-tertiary:  #7E7871;
--ink-muted:     #5C5750;

--dot:           #302E2B;
```

Pola tangganya identik dengan light mode: L2 lebih gelap dari L1, L3 naik lagi. Rasa kedalaman jadi sama di kedua mode.

### Accent

Lima accent, satu per tipe kartu. Nilai `ink` sudah dihitung ulang untuk permukaan krem — nilai dari versi Notion tidak berlaku lagi karena base surface-nya berubah.

| Tipe | Nama | tint | line | ink |
|---|---|---|---|---|
| note | sand | `#F5F0E6` | `#E0D3BB` | `#7D6B4C` |
| todo | sage | `#EDF2EC` | `#C9D9CB` | `#57755E` |
| image | clay | `#F8EFEB` | `#E5CEC6` | `#906256` |
| link | slate | `#EDF1F5` | `#CBD6E1` | `#596F88` |
| board | plum | `#F3EEF3` | `#DACCDA` | `#7D6180` |

Kontras `ink` diverifikasi di **tiga** permukaan sekaligus, karena accent bisa muncul di kartu maupun di blok inset — di atas `tint`: 4.53 / 4.50 / 4.56 / 4.56 / 4.71; di atas `--surface`: 5.02–5.30; di atas `--surface-inset`: 4.53–4.78. Semua lolos AA. Nilai `ink` sengaja digelapkan dari titik estetis awalnya untuk memenuhi ambang ini; jangan dicerahkan tanpa mengecek ulang.

Dark mode: `tint` jadi 10% opacity dari `ink` di atas `--surface`, `line` jadi 22%, `ink` dinaikkan lightness sampai kontras ≥ 4.5:1.

**Aturan pemakaian** (tidak berubah): accent hanya muncul di strip 2px kiri kartu dan pada icon tipe. Background kartu tetap `--surface`. `tint` hanya saat kartu selected atau hover.

---

## 3. Typography

Sans mengerjakan hampir semuanya. Serif muncul di dua tempat saja.

```css
--font-display: "Instrument Serif", "Newsreader", Georgia, serif;
--font-body:    "Inter", ui-sans-serif, -apple-system, sans-serif;
--font-mono:    ui-monospace, "SF Mono", Menlo, monospace;
```

**Aturan serif**: hanya untuk teks ≥26px. Itu berarti board title dan empty state. Tidak ada tempat lain.

Ini koreksi dari revisi sebelumnya, yang memakai serif untuk judul kartu 17px. Pada ukuran itu, kontras stroke Instrument Serif menghilang dan hasilnya cuma terbaca sebagai font yang berbeda tanpa memberi apa-apa. Serif butuh ukuran untuk bekerja. Referensi Craft memperlakukannya persis begitu — serif besar di headline, sans di mana-mana lagi.

**Instrument Serif** untuk display: kontras stroke tinggi, terminal tajam, italic yang benar-benar berbeda bentuknya. Gratis di Google Fonts. Alternatif yang lebih tenang: **Newsreader**. Hindari Playfair Display — terlalu didekorasi dan terlalu sering dipakai, langsung terbaca sebagai template.

**Inter** untuk sisanya, dengan `font-feature-settings: "cv11", "ss01"`.

### Scale

| Token | Font | Size | Line | Weight | Pakai untuk |
|---|---|---|---|---|---|
| `text-2xs` | body | 11px | 16px | 500 | Timestamp, chip label |
| `text-xs` | body | 12px | 18px | 400 | Card meta, breadcrumb |
| `text-sm` | body | 13px | 21px | 400 | **Body kartu — default** |
| `text-base` | body | 14px | 22px | 400 | Body list view, komentar |
| `label` | body | 13px | 18px | **600** | Label blok inset |
| `title-card` | body | 15px | 21px | **600** | **Judul kartu — sans bold** |
| `title-section` | body | 17px | 24px | **600** | Judul di dalam kartu besar |
| `title-board` | **display** | 28px | 34px | 400 | Judul board di header |
| `title-empty` | **display** | 34px | 42px | 400 | Empty state |

Judul kartu **sans 15px weight 600**. Ini yang dipakai referensi dan alasannya praktis: judul kartu harus terbaca cepat saat mata menyapu 30 kartu sekaligus, dan sans bold menang telak untuk itu.

Serif selalu weight 400, tidak pernah bold — kontras stroke-nya sudah memberi bobot. Penekanan pakai **italic**.

Tracking: serif `-0.015em` (ukuran besar butuh tracking lebih rapat), sans `-0.011em` untuk ≥14px, normal di bawahnya.

---

## 4. Iconography

Perubahan besar kedua. Semua icon diganti.

```
stroke-width: 1.5px
fill: none
stroke-linecap: round
stroke-linejoin: round
color: currentColor  (mewarisi --ink-secondary di chrome, accent.ink di kartu)
```

Ukuran: 16px di dalam kartu, 18px di chrome, 20px di empty state. Selalu kelipatan 2 supaya stroke 1.5px jatuh di posisi piksel yang bersih.

**Library**: Lucide. Stroke-nya konsisten 2px secara default — override ke 1.5px secara global lewat provider atau prop per-icon. Alternatif dengan karakter lebih dekat ke referensi: Phosphor Icons dengan weight "light".

**Tidak boleh**: icon ber-fill, icon dua warna, icon dengan background lingkaran/kotak berwarna. Ini yang membuat Milanote terasa ramai, dan menghindarinya adalah salah satu alasan utama produk ini ada.

Icon per tipe kartu: note → `file-text`, todo → `circle-check`, image → `image`, link → `link`, board → `layout-grid`.

---

## 5. Spacing & geometry

Dinaikkan dari versi sebelumnya. Referensi Craft jauh lebih lega, dan itu bagian besar dari kenapa terasa tenang.

```css
--space-1: 4px;    --space-4: 20px;   /* naik dari 16 */
--space-2: 8px;    --space-5: 28px;   /* naik dari 24 */
--space-3: 14px;   --space-6: 40px;   /* naik dari 32 */

--radius-sm: 5px;   /* checkbox, chip, icon button */
--radius-inset: 7px;/* blok inset di dalam kartu */
--radius-md: 10px;  /* kartu */
--radius-lg: 14px;  /* modal, command palette */
```

Radius kartu 10px, blok inset di dalamnya 7px. Aturannya: **radius anak selalu lebih kecil dari induknya**, kira-kira `radius_induk − padding/2`. Kalau radius anak sama atau lebih besar, sudutnya terlihat menabrak sudut induk dan hasilnya terasa sesak.

Padding kartu: `16px 18px`. Padding blok inset: `12px 14px`.

**Grid kanvas**: 8px, tidak berubah.

**Ukuran kartu default**:
| Tipe | w × h | Resize |
|---|---|---|
| note | 280 × auto (min 96) | w saja |
| todo | 280 × auto | w saja |
| image | aspect ratio, w default 300 | proporsional |
| link | 300 × 104 | w saja |
| board | 210 × 76 | tidak |

Kartu yang berisi blok inset butuh lebar minimum 260px — di bawah itu, padding bersarang (18 + 14 + isi) menyisakan ruang teks yang terlalu sempit.

---

## 6. Elevation

Kartu **punya shadow**. Ini membatalkan keputusan tanpa-shadow di dua revisi sebelumnya.

```css
--shadow-card:  0 1px 2px rgba(60,48,30,0.05),
                0 4px 12px rgba(60,48,30,0.05);
--shadow-hover: 0 2px 4px rgba(60,48,30,0.06),
                0 8px 20px rgba(60,48,30,0.07);
--shadow-drag:  0 12px 32px rgba(60,48,30,0.14),
                0 3px 8px rgba(60,48,30,0.07);
--shadow-float: 0 16px 40px rgba(60,48,30,0.12),
                0 3px 8px rgba(60,48,30,0.06);
```

**Kenapa berubah.** Argumen tanpa-shadow sebelumnya adalah "30 kartu = 30 sumber noise," dan itu benar untuk shadow tebal ala Milanote. Tapi shadow *halus* mengerjakan hal berbeda: dia memberi kartu wujud fisik tanpa berteriak. Referensi Craft memakainya, dan hasilnya justru lebih tenang daripada kartu datar — karena mata langsung tahu mana objek dan mana latar, tanpa perlu bekerja keras membedakan dua permukaan yang hampir sama terangnya.

Yang penting adalah **dua lapis**: blur kecil rapat untuk ketegasan tepi, blur besar longgar untuk kesan mengambang. Satu shadow saja selalu terlihat murah — entah terlalu keras atau terlalu kabur.

Opacity total sangat rendah (0.05 + 0.05). Kalau terlihat jelas sebagai bayangan, berarti sudah kelewatan.

Basis warnanya cokelat (`rgba(60,48,30,…)`), bukan abu netral. Shadow abu di atas krem terbaca sebagai noda kotor, bukan bayangan — kesalahan yang gampang lolos sampai tahap implementasi.

**Blok inset (L2) tidak punya shadow.** Dia turun ke dalam, bukan naik ke atas. Yang membedakannya cuma warna permukaan. Menaruh inner shadow di situ adalah godaan yang harus ditolak — hasilnya selalu terlihat seperti kolom form tahun 2010.

---

## 7. Dot grid

Tetap ada, hanya warnanya menyesuaikan palet baru.

```css
background-image: radial-gradient(circle, var(--dot) 1px, transparent 1px);
background-size: 24px 24px;
background-position: 8px 8px;
```

`--dot: #E0DBD2` (light) / `#302E2B` (dark). Kontras 1.30 di light, 1.298 di dark — cukup terlihat untuk orientasi, jauh di bawah ambang yang membuatnya bersaing dengan konten.

Dot grid fungsional, bukan dekoratif: memberi referensi spasial saat pan (tanpa itu kanvas kosong terasa tidak bergerak) dan mengonfirmasi snap 8px.

**Revisi — kanvas tidak lagi tak terbatas.** Versi sebelumnya menyebut "rasa ruang tak terbatas tanpa border" sebagai fungsi ketiga dot grid. Board sekarang berukuran tetap (`BOARD_W` × `BOARD_H` di `src/store/canvasStore.ts`, kini 2000×1500 — dikecilkan dari 4000×3000 setelah terasa terlalu luas dipakai) dan pan di-clamp ke tepinya.

Alasannya: bidang tak terbatas tidak memberi apa pun untuk berorientasi. Pan cukup jauh dan tiap layar terlihat sama, tanpa petunjuk arah pulang. Batas yang terlihat mengubah "aku tersesat" jadi "aku di pojok kanan bawah".

Konsekuensi implementasi: dot grid pindah ke dalam world layer, bukan screen-space. Grid jadi ter-clip sendiri ke tepi board, `background-size` dalam satuan world sehingga skalanya ditangani transform layer, dan radius dot dibagi zoom supaya tetap konstan di layar. Pan tetap satu transform di satu elemen.

**Spacing 24px, bukan 8px.** Snap tetap 8px, tapi dot tiap 8px menghasilkan 9x lebih banyak titik dan terbaca sebagai bidang abu-abu, bukan grid. 24px = tiap 3 langkah snap.

**Skala mengikuti zoom.** Bagian yang paling sering salah:

```js
const gap = 24 * zoom;
const dotSize = Math.min(1.4, Math.max(0.6, zoom));
```

Tanpa mengalikan `background-size` dengan zoom, dot merapat jadi tekstur saat zoom out dan membesar jadi polkadot saat zoom in. Ukuran dot di-clamp: di bawah 0.6px hilang, di atas 1.4px terbaca sebagai lingkaran.

**Fade di zoom ekstrem.** Di bawah 50%, opacity turun linear ke 0 pada 25%. Di atas 150%, turun ke 0.5.

**Implementasi**: CSS `background-image` pada elemen kanvas — bukan SVG, bukan canvas element. Browser me-render ini di compositor, jadi pan tetap 60fps tanpa repaint. Menggambar dot sebagai DOM atau SVG adalah cara tercepat membunuh performa di board besar.

Saat drag dengan snap aktif, dot terdekat dengan sudut kartu naik opacity sebentar (120ms) sebagai konfirmasi. Efek kecil, tapi ini yang membuat snap terasa disengaja alih-alih terasa meleset.

---

## 8. Anatomi kartu

Kartu punya tiga zona: **header** (icon + judul), **body** (isi), **meta** (attribution). Body bisa berisi teks biasa, atau satu/lebih blok inset.

```
┌────────────────────────────────┐
│▌  ▢  Tasks                  ⋯  │  ← header: icon 18px + judul sans 15/600
│▌                               │
│▌  ┌──────────────────────────┐ │
│▌  │ This Day            ⋯    │ │  ← blok inset (L2), label 13/600
│▌  │                          │ │
│▌  │ ☐ Research ferry     ... │ │
│▌  │ ☑ Completed tasks        │ │
│▌  └──────────────────────────┘ │
│▌                               │
│▌  Body teks kalau ada, sans    │
│▌  13px, warna --ink.           │
│▌                               │
│▌  2 hari lalu · Rani           │  ← meta 11px --ink-tertiary
└────────────────────────────────┘
        padding: 16px 18px
```

- Strip accent 2px di tepi kiri, tinggi penuh, tanpa radius di sisi kiri
- Tidak ada border di keempat sisi — yang memisahkan adalah `--shadow-card`
- Header selalu ada icon tipe di kiri judul, 18px, warna `accent.ink`
- Jarak header→body 12px, body→meta 14px
- Meta menampilkan waktu dan **siapa yang terakhir mengubah** (lihat PRD bagian 2)

### Blok inset (L2)

Ini yang membuat kartu bisa memuat struktur. Dipakai untuk: daftar task di dalam kartu, kutipan, blok tanggal, ringkasan tersemat.

```css
background: var(--surface-inset);
border-radius: 7px;
padding: 12px 14px;
box-shadow: none;
```

- **Tanpa border dan tanpa shadow.** Yang membedakan dari kartu induknya cuma warna permukaan (kontras 1.109).
- Label blok pakai `label` token (13px/600), warna `--ink`. Kalau ada aksi, taruh `⋯` di kanan label, muncul on-hover.
- Blok inset boleh berisi blok L3 (`--surface-raised`, putih) — misalnya satu item yang di-highlight di dalam daftar. **Berhenti di L3.** Empat lapis tidak pernah dibutuhkan dan mulai terlihat seperti tumpukan kotak.
- Beberapa blok inset berturut-turut dipisah jarak 10px, bukan garis.

### Item di dalam blok

Checkbox, baris task, dan entri daftar hidup di dalam blok inset:

- Checkbox 16px, `--radius-sm`, border 1.5px `--border-strong`, tanpa fill saat kosong
- Checkbox tercentang: fill `accent.ink`, ikon centang putih stroke 2px
- Teks item selesai: `--ink-muted` + `line-through`
- Chip/tag inline: `--surface-raised`, `--radius-sm`, padding `2px 7px`, `text-2xs`, warna `--ink-secondary`
- Baris item punya hover `rgba(0,0,0,0.02)` dengan radius 5px, meluber 6px ke kiri-kanan di luar padding blok

### States

| State | Perubahan |
|---|---|
| default | `--surface` + `--shadow-card` |
| hover | `--surface-hover` + `--shadow-hover`, menu ⋯ fade in 120ms |
| selected | ring 1.5px `accent.line` + `--shadow-hover`, background tetap `--surface` |
| multi-selected | sama, plus ring pada bounding box gabungan |
| dragging | `--shadow-drag`, opacity 0.94, snap indicator garis 1px `accent.line` |
| editing (self) | ring 1.5px `accent.line` |
| editing (orang lain) | ring 1.5px `accent.line` dashed + avatar stack 16px pojok kanan atas, maks 2 lalu `+N` |
| punya komentar | dot 6px `--ink-tertiary` pojok kanan atas, 6px dari tepi |
| loading (image) | `--surface-inset`, aspect ratio benar, shimmer halus (opacity 0.4→0.6, 1.4s) |

Perhatikan state **selected** tidak lagi mengubah background jadi `accent.tint` seperti revisi sebelumnya. Dengan shadow dan blok inset di dalam kartu, mengubah background kartu membuat kontras internalnya kacau — blok inset jadi tidak terbaca. Ring saja sudah cukup jelas.

Focus ring keyboard: `outline: 2px solid var(--focus)`, `outline-offset: 2px`.

```css
--focus: #4A6FA5;   /* light */
--focus: #7DA0D4;   /* dark */
```

Terpisah dari accent supaya focus terbaca sama di semua tipe kartu.

---

## 9. Chrome kanvas

**Header** — 48px, `rgba(255,254,251,0.82)` dengan `backdrop-filter: blur(12px)`, border-bottom 0.5px `--border`.

Tembus pandang supaya dot grid samar terlihat menembusnya saat kanvas di-pan — itu yang membuat header terasa sebagai lapisan di atas kanvas, bukan bar tertempel. Dark: `rgba(35,34,32,0.82)`.

Breadcrumb: segmen terakhir sans **15px/600** `--ink`, segmen sebelumnya sans `text-xs` `--ink-secondary`, pemisah `/` dengan `--border-strong`. Lebih dari 4 level → tengahnya jadi `…` yang bisa diklik.

Serif **tidak** dipakai di breadcrumb. Pada 15px serif tidak memberi apa-apa (lihat bagian 3). Judul board pakai serif hanya kalau ditampilkan besar — misalnya di halaman board kosong.

**Segmented control (Canvas / List)** — track `--surface-inset`, `--radius-sm` +2, padding 2px. Thumb aktif `--surface`, `--radius-sm`, padding `4px 12px`, `text-xs`.

Tanpa border. Pola lama menggambar kotak di sekeliling pilihan; pola ini memberi alas lalu mengangkat yang aktif. Thumb berpindah dengan transisi 160ms, bukan muncul-hilang.

**Icon button** — 30px persegi, `--radius-sm`, icon 18px stroke 1.5px `--ink-secondary`. Tanpa border, tanpa background di default. Hover: `--surface-inset`. Aktif: `--surface-inset` + icon `--ink`.

Shortcut keyboard **tidak ditampilkan sebagai chip permanen**. Itu kebiasaan lama yang memakan ruang untuk informasi yang dibutuhkan sekali. Taruh di tooltip (delay 500ms) dan di dalam ⌘K.

**Presence** — avatar stack 24px pojok kanan header, overlap -7px, ring pakai `box-shadow: 0 0 0 2px var(--surface)` bukan `border` (border menambah ukuran box, shadow tidak — overlap jadi lebih rapat). Maksimal 4 terlihat lalu `+N`.

Cursor: pointer SVG dengan warna tetap per user, di-assign deterministik dari hash user id ke palet 12 warna. **Sistem warna terpisah dari accent kartu** — accent menandakan tipe kartu, cursor menandakan identitas orang. Mencampurnya membuat warna kehilangan makna tunggalnya. Maksimal 8 cursor ditampilkan; prioritaskan yang terdekat viewport.

**Zoom control** — pojok kanan bawah, tiga bagian dalam satu track: `−`, persentase, `+`. Background `rgba(255,254,251,0.9)` + blur 8px, `--radius-sm` +2, padding 2px. Tombol 28px, angka `text-xs` dengan `min-width: 40px` supaya tidak bergeser saat berubah dari 100% ke 75%. Klik angka = reset. Fade ke opacity 0.45 setelah 2 detik idle.

**Empty state** — **serif 34px** `--ink-secondary` di tengah kanvas: "Klik dua kali di mana saja untuk mulai." Ini salah satu dari dua tempat serif dipakai, dan ukurannya cukup besar untuk karakternya terbaca. Tanpa ilustrasi, tanpa tombol. Hilang saat kartu pertama dibuat.

---

## 10. Motion

```css
--ease: cubic-bezier(0.2, 0, 0.13, 1);
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
```

| Transisi | Durasi | Easing |
|---|---|---|
| Hover state | 120ms | `--ease` |
| Kartu muncul | 160ms | `--ease-out` (scale 0.96→1, opacity 0→1) |
| Kartu hilang | 120ms | `--ease` (opacity saja) |
| Masuk board | 240ms | `--ease-out` (scale ke viewport + cross-fade) |
| Keluar board | 200ms | `--ease` |
| Segmented thumb | 160ms | `--ease` |
| Zoom | 0ms saat gesture, 180ms via tombol | `--ease` |
| Toast | 180ms masuk, 120ms keluar | `--ease` |

Hormati `prefers-reduced-motion`: semua jadi opacity saja, durasi 80ms, transisi masuk-board jadi cut langsung.

---

## 11. Hand-drawn layer

Satu-satunya tempat sistem ini keluar dari bahasa Craft, dan sengaja dibatasi. Dengan icon yang sekarang line-art stroke tipis, elemen hand-drawn justru lebih menyatu daripada di versi Notion — keduanya bahasa garis.

**Connector antar kartu**: path SVG dengan jitter halus (amplitudo 1.5px, 3 titik kontrol), `stroke-width: 1.5` (sama dengan icon, sengaja), `--ink-tertiary`, `stroke-linecap: round`.

**Highlight**: saat kartu ditandai penting, marker sweep di belakang judul — SVG path ujung tidak rata, `accent.tint`, opacity 0.7, `mix-blend-mode: multiply`.

Dua elemen. Godaan menambah lebih banyak harus ditolak — begitu dekorasi jadi lebih dari aksen, produk kehilangan sifat calm-nya.

---

## 12. Accessibility

- Semua pasangan teks/background ≥ 4.5:1. Sudah diverifikasi untuk kelima accent di permukaan krem.
- Kontras diverifikasi di **ketiga** permukaan (kartu, blok inset, blok raised), bukan cuma di kartu. Accent ink lolos AA di semuanya (terendah 4.50).
- `--ink-tertiary` (2.96 di surface / 2.67 di inset) hanya untuk teks ≥18px atau elemen non-esensial. `--ink-muted` hanya untuk teks yang memang sudah nonaktif, seperti task selesai — dan di situ `line-through` yang membawa maknanya, bukan warnanya.
- Focus ring terpisah dari accent, konsisten, tidak pernah `outline: none` tanpa pengganti.
- Kanvas bisa dinavigasi keyboard: Tab berpindah antar kartu berdasarkan posisi (kiri-ke-kanan, atas-ke-bawah), Enter untuk edit, Esc keluar, arrow menggeser kartu terpilih 8px (shift+arrow = 1px).
- Kartu adalah `<article>` dengan `aria-label` berisi tipe dan judul. Kanvas `role="application"` dengan instruksi di `aria-describedby`.
- Presence cursor `aria-hidden` — noise untuk screen reader.
- Touch target minimum 32px untuk semua kontrol.
- Serif hanya dipakai ≥26px, jadi masalah keterbacaan serif di ukuran kecil tidak muncul sama sekali.
- Blok inset tidak boleh jadi satu-satunya penanda pengelompokan untuk screen reader — bungkus dengan `<section>` + `aria-label`, karena perbedaan warna 1.109 tidak terbaca oleh siapa pun yang tidak melihatnya.

---

## 13. Yang sengaja tidak dilakukan

- **Tidak ada paper texture, noise, atau grain.** Dot grid dipakai karena fungsional; texture murni dekorasi dan akan membuat krem terlihat kotor.
- **Tidak ada border di kartu maupun blok inset.** Pemisahan dikerjakan oleh shadow (kartu) dan warna permukaan (inset). Menambah border di atas keduanya adalah redundansi yang membuat layar terlihat seperti tabel.
- **Tidak ada inner shadow di blok inset.** Selalu terlihat seperti input form tahun 2010.
- **Tidak lebih dari tiga lapis permukaan.** L1 kartu, L2 inset, L3 raised. Lapis keempat tidak pernah dibutuhkan.
- **Tidak ada warna penuh sebagai background kartu.** Accent hanya strip dan tint saat aktif.
- **Serif tidak pernah bold, dan tidak pernah di bawah 26px.** Kontras stroke tinggi sudah memberi bobot; menebalkannya terlihat murah. Di ukuran kecil serif kehilangan karakternya dan cuma jadi font yang berbeda tanpa alasan.
- **Icon tidak pernah di-fill atau diberi background berwarna.** Ini pembeda utama dari Milanote.
- **Shadow tidak pakai abu netral.** Basis cokelat, karena abu di atas krem terbaca sebagai noda.
- **Shadow tidak pernah satu lapis.** Selalu dua: blur kecil rapat + blur besar longgar.
- **Warna cursor tidak diambil dari palet accent.** Dua sistem warna untuk dua makna berbeda.
- **Avatar tidak pakai foto di kartu.** Inisial di lingkaran warna; foto pada 16px cuma noise. Di header 24px baru pakai foto kalau ada.
- **Tidak ada custom scrollbar.** Native lebih baik.
- **Tidak ada dark mode toggle manual di v1.** Ikuti `prefers-color-scheme`.
