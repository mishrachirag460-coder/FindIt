export default function Hero({ onOpenLostModal, onOpenFoundModal, onScrollToFeed }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/70 via-white to-white py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Main Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1 text-xs font-semibold text-blue-700 shadow-2xs">
            <span>🛡️ Campus Item Recovery & Coordination System</span>
          </div>

          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl md:text-6xl">
            Find What You Lost. <br />
            <span className="text-blue-700">Return What You Found.</span>
          </h1>

          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            A secure, privacy-first recovery platform for students, teachers, and campus staff. 
            Connects owners, finders, and custodians through blind proof verification and audited custody handovers.
          </p>

          {/* Call to Actions */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenLostModal}
              className="flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-700/20 transition hover:bg-blue-800"
            >
              <span>🔍</span>
              <span>Report Lost Item</span>
            </button>

            <button
              type="button"
              onClick={onOpenFoundModal}
              className="flex items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
            >
              <span>📦</span>
              <span>Report Found Item</span>
            </button>

            <button
              type="button"
              onClick={onScrollToFeed}
              className="rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
            >
              Browse Campus Feed ↓
            </button>
          </div>
        </div>

        {/* 3 Core Workflow Pillars */}
        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-700">
              📋
            </div>
            <h3 className="mt-4 font-bold text-slate-900">1. Report & Track</h3>
            <p className="mt-1.5 text-xs text-slate-600">
              Students and staff post lost and found notices with essential descriptive details visible in the live campus feed.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-xl text-purple-700">
              🔒
            </div>
            <h3 className="mt-4 font-bold text-slate-900">2. Private Ownership Proof</h3>
            <p className="mt-1.5 text-xs text-slate-600">
              Claimants submit independent proof. Secret markers and serial hints remain strictly confidential to eliminate false claims.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-xl text-green-700">
              🤝
            </div>
            <h3 className="mt-4 font-bold text-slate-900">3. Verified Handover</h3>
            <p className="mt-1.5 text-xs text-slate-600">
              Custodians coordinate safe physical item release, transfer custody to staff via FindIt ID, and log immutable audit records.
            </p>
          </div>
        </div>

      </div>
    </section>
  )
}
