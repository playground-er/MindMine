import { useState, type FormEvent } from 'react'

import { sendMagicLink } from '../hooks/useSession'

type Status = 'idle' | 'sending' | 'sent' | 'error'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || status === 'sending') return

    setStatus('sending')
    try {
      await sendMagicLink(email.trim())
      setStatus('sent')
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Gagal mengirim tautan.')
    }
  }

  return (
    <div className="grid h-full w-full place-items-center bg-canvas px-4">
      <div className="w-full max-w-[340px]">
        <h1 className="mb-5 font-display text-title-board text-ink">MindMine</h1>

        {status === 'sent' ? (
          <p className="text-sm text-ink-secondary">
            Tautan masuk sudah dikirim ke <span className="text-ink">{email}</span>. Buka email itu
            di perangkat ini.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              aria-label="Alamat email"
              className="h-10 rounded-inset bg-surface px-3 text-sm text-ink shadow-card outline-none placeholder:text-ink-tertiary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="h-10 rounded-inset bg-ink text-label text-canvas transition-opacity duration-[120ms] hover:opacity-90 disabled:opacity-50"
            >
              {status === 'sending' ? 'Mengirim…' : 'Kirim tautan masuk'}
            </button>

            {status === 'error' && (
              <p role="alert" className="text-xs text-ink-secondary">
                {message}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

/**
 * Authenticated but absent from `member`. Deliberately a dead end: there is no
 * invite UI by design, so the only honest thing to show is who to ask.
 */
export function NotRegistered({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <div className="grid h-full w-full place-items-center bg-canvas px-4">
      <div className="w-full max-w-[380px]">
        <h1 className="mb-3 font-display text-title-board text-ink">Belum terdaftar</h1>
        <p className="mb-5 text-sm text-ink-secondary">
          <span className="text-ink">{email}</span> berhasil masuk, tapi belum terdaftar sebagai
          anggota. Minta seseorang yang sudah punya akses untuk mendaftarkan email ini.
        </p>
        <button
          type="button"
          onClick={onSignOut}
          className="text-label text-ink-secondary underline underline-offset-4 transition-colors duration-[120ms] hover:text-ink"
        >
          Keluar
        </button>
      </div>
    </div>
  )
}
