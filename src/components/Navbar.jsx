import { useAuth } from '../context/AuthContext'

export default function Navbar({
  activeView,
  setActiveView,
  onOpenLostModal,
  onOpenFoundModal,
  onOpenSignIn,
  onOpenSignUp,
}) {
  const { user, profile, signOut, loading } = useAuth()

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        
        {/* Brand Logo & Tagline */}
        <div 
          onClick={() => setActiveView('feed')}
          className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-90"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-xl font-black text-white shadow-sm">
            F
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-slate-900">FindIt</span>
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-600/20">
                Campus Recovery
              </span>
            </div>
            <p className="hidden text-xs text-slate-500 sm:block">Campus Item Recovery & Coordination</p>
          </div>
        </div>

        {/* Center Navigation Links */}
        <nav className="hidden items-center gap-1 md:flex">
          <button
            type="button"
            onClick={() => setActiveView('feed')}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              activeView === 'feed'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Live Campus Feed
          </button>

          {user && (
            <button
              type="button"
              onClick={() => setActiveView('dashboard')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                activeView === 'dashboard'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              My Dashboard
            </button>
          )}

          <button
            type="button"
            onClick={onOpenLostModal}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Report Lost
          </button>

          <button
            type="button"
            onClick={onOpenFoundModal}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Report Found
          </button>
        </nav>

        {/* Right Auth / Profile Controls */}
        <div className="flex items-center gap-3">
          {loading ? (
            <div className="h-9 w-24 animate-pulse rounded-lg bg-slate-100" />
          ) : user ? (
            <div className="flex items-center gap-3">
              {/* Profile Chip */}
              <div 
                onClick={() => setActiveView('dashboard')}
                className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 transition hover:border-slate-300 hover:bg-slate-100"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-700 text-xs font-bold text-white">
                  {profile?.full_name ? profile.full_name[0].toUpperCase() : 'U'}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800">
                      {profile?.full_name || user.email?.split('@')[0]}
                    </span>
                    {profile?.member_type && (
                      <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[10px] font-semibold text-slate-700">
                        {profile.member_type}
                      </span>
                    )}
                  </div>
                  {profile?.findit_id ? (
                    <span className="block font-mono text-[11px] font-medium text-blue-700">
                      ID: {profile.findit_id}
                    </span>
                  ) : (
                    <span className="block text-[11px] text-slate-500">
                      {user.email}
                    </span>
                  )}
                </div>
              </div>

              {/* Sign Out Button */}
              <button
                type="button"
                onClick={signOut}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenSignIn}
                className="rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={onOpenSignUp}
                className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-800"
              >
                Register
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  )
}
