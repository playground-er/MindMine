# MindMine

Papan ide visual untuk tim internal. Kanvas bebas, kartu bertipe, board bersarang — dengan kolaborasi realtime.

## Dokumen

- [`docs/PRD.md`](docs/PRD.md) — apa yang dibangun dan kenapa
- [`docs/DESIGN-SPEC.md`](docs/DESIGN-SPEC.md) — token, komponen, bahasa visual
- [`docs/HANDOFF.md`](docs/HANDOFF.md) — ringkasan keputusan + build order
- [`CLAUDE.md`](CLAUDE.md) — konteks untuk Claude Code

## Setup

```bash
npm install
cp .env.example .env.local   # lalu isi kredensial Supabase
npm run dev
```

Jalankan migration di `supabase/migrations/` lewat SQL Editor di dashboard Supabase, urut nomor.

## Menambah anggota tim

Tidak ada UI invite — sengaja. Tambahkan lewat SQL Editor:

```sql
insert into member (id, email, name)
values ('<auth-user-uuid>', 'orang@email.com', 'Nama');
```

UUID didapat dari Authentication > Users setelah orang tersebut login pertama kali lewat magic link.

## Stack

Vite · React 18 · TypeScript · Tailwind · Supabase · Yjs · Zustand · TanStack Query
