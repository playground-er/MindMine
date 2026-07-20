import { BoardView } from './components/BoardView'
import { LoginPage, NotRegistered } from './components/LoginPage'
import { useAuthSession, useMember, signOut } from './hooks/useSession'
import { isSupabaseConfigured } from './lib/supabase'

export default function App() {
  const { session, isLoading } = useAuthSession()
  const memberQuery = useMember(session?.user.id)

  if (!isSupabaseConfigured()) {
    return (
      <Centered>
        Supabase belum dikonfigurasi. Salin <code>.env.example</code> ke <code>.env.local</code>,
        lalu jalankan ulang dev server.
      </Centered>
    )
  }

  if (isLoading) return <Centered>Memuat…</Centered>
  if (!session) return <LoginPage />

  // Authenticated, but the member row decides whether there is anything to show.
  if (memberQuery.isLoading) return <Centered>Memeriksa keanggotaan…</Centered>
  if (!memberQuery.data) {
    return <NotRegistered email={session.user.email ?? ''} onSignOut={() => void signOut()} />
  }

  return <BoardView member={memberQuery.data} />
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-full w-full place-items-center bg-canvas px-6">
      <p className="max-w-[380px] text-center text-sm text-ink-secondary">{children}</p>
    </div>
  )
}
