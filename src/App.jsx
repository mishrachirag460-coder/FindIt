import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './context/AuthContext'
import { fetchPublicFeed } from './services/reportService'

import Navbar from './components/Navbar'
import Hero from './components/Hero'
import CampusFeed from './components/CampusFeed'
import Dashboard from './components/Dashboard'
import AuthModal from './components/AuthModal'
import LostReportModal from './components/LostReportModal'
import FoundReportModal from './components/FoundReportModal'
import ClaimModal from './components/ClaimModal'

export default function App() {
  const { user, profile } = useAuth()

  // Primary navigation view: 'feed' | 'dashboard'
  const [activeView, setActiveView] = useState('feed')

  // Modals state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authModalTab, setAuthModalTab] = useState('signin')
  const [isLostModalOpen, setIsLostModalOpen] = useState(false)
  const [isFoundModalOpen, setIsFoundModalOpen] = useState(false)
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false)
  const [claimTargetItem, setClaimTargetItem] = useState(null)

  // Public Feed state
  const [lostReports, setLostReports] = useState([])
  const [foundReports, setFoundReports] = useState([])
  const [loadingFeed, setLoadingFeed] = useState(true)
  const [feedError, setFeedError] = useState(null)

  // Success notification toast
  const [toastMessage, setToastMessage] = useState(null)

  const showToast = (message) => {
    setToastMessage(message)
    setTimeout(() => {
      setToastMessage(null)
    }, 4000)
  }

  // Load live campus feed
  const loadFeed = useCallback(async () => {
    setLoadingFeed(true)
    setFeedError(null)

    try {
      const { lostItems, foundItems, error } = await fetchPublicFeed()
      setLostReports(lostItems || [])
      setFoundReports(foundItems || [])
      if (error) {
        setFeedError(error)
      }
    } catch (err) {
      console.error('Error fetching public feed:', err)
      setFeedError(err.message || 'Failed to load campus feed')
    } finally {
      setLoadingFeed(false)
    }
  }, [])

  useEffect(() => {
    loadFeed()
  }, [loadFeed])

  // Auth triggers
  const handleOpenSignIn = () => {
    setAuthModalTab('signin')
    setIsAuthModalOpen(true)
  }

  const handleOpenSignUp = () => {
    setAuthModalTab('register')
    setIsAuthModalOpen(true)
  }

  // Report triggers (gated by authentication)
  const handleOpenLostModal = () => {
    if (!user) {
      handleOpenSignIn()
      return
    }
    setIsLostModalOpen(true)
  }

  const handleOpenFoundModal = () => {
    if (!user) {
      handleOpenSignIn()
      return
    }
    setIsFoundModalOpen(true)
  }

  // Claim item trigger
  const handleClaimItem = (item) => {
    if (!user) {
      handleOpenSignIn()
      return
    }
    setClaimTargetItem(item)
    setIsClaimModalOpen(true)
  }

  // Scroll smoothly to feed section
  const handleScrollToFeed = () => {
    setActiveView('feed')
    setTimeout(() => {
      const feedEl = document.getElementById('campus-feed')
      if (feedEl) {
        feedEl.scrollIntoView({ behavior: 'smooth' })
      }
    }, 50)
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      
      {/* Navigation Bar */}
      <Navbar
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenLostModal={handleOpenLostModal}
        onOpenFoundModal={handleOpenFoundModal}
        onOpenSignIn={handleOpenSignIn}
        onOpenSignUp={handleOpenSignUp}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-900 shadow-lg animate-bounce">
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main>
        {activeView === 'feed' ? (
          <>
            {/* Hero Section */}
            <Hero
              onOpenLostModal={handleOpenLostModal}
              onOpenFoundModal={handleOpenFoundModal}
              onScrollToFeed={handleScrollToFeed}
            />

            {/* Live Campus Feed Section */}
            <CampusFeed
              lostReports={lostReports}
              foundReports={foundReports}
              loading={loadingFeed}
              error={feedError}
              onRefresh={loadFeed}
              onClaimItem={handleClaimItem}
              onOpenLostModal={handleOpenLostModal}
              onOpenFoundModal={handleOpenFoundModal}
              user={user}
            />

            {/* How It Works Section */}
            <section className="border-t border-slate-200 bg-white py-16">
              <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                  Reliable Campus Coordination
                </span>
                <h2 className="mt-3 text-3xl font-extrabold text-slate-950">
                  How FindIt Connects Campus
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Bridging the gap between discovering an item and handing it back safely.
                </p>

                <div className="mt-12 grid gap-8 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 text-left">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-700 text-lg font-black text-white">
                      01
                    </div>
                    <h3 className="mt-4 font-bold text-slate-900">Report with Private Clues</h3>
                    <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                      Finders post public notices while securely storing private identification clues (scratches, lock screen, serial hints) that only the true owner would know.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 text-left">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-700 text-lg font-black text-white">
                      02
                    </div>
                    <h3 className="mt-4 font-bold text-slate-900">Blind Proof Verification</h3>
                    <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                      Owners submit private verification details directly to the custodian. False claimants cannot see the clues or discover who is holding the item.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 text-left">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-700 text-lg font-black text-white">
                      03
                    </div>
                    <h3 className="mt-4 font-bold text-slate-900">Audited Handover</h3>
                    <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                      Once verified, custody is handed over with recorded notes and mutual receipt confirmation, updating the item status to recovered.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : (
          /* Dashboard View */
          user ? (
            <Dashboard
              onOpenLostModal={handleOpenLostModal}
              onOpenFoundModal={handleOpenFoundModal}
            />
          ) : (
            <div className="py-20 text-center">
              <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xs">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl text-blue-700">
                  🔒
                </div>
                <h2 className="mt-4 text-xl font-bold text-slate-900">Member Sign-In Required</h2>
                <p className="mt-2 text-xs text-slate-500">
                  Please sign in with your campus account to view your recovery claims, items in your custody, and custody transfers.
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleOpenSignIn}
                    className="rounded-xl bg-blue-700 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-800"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenSignUp}
                    className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Register Account
                  </button>
                </div>
              </div>
            </div>
          )
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-10 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-700 text-xs font-bold text-white">
              F
            </span>
            <span className="text-base font-black text-slate-900">FindIt.</span>
          </div>
          <p className="mt-2">Campus Item Recovery & Coordination System</p>
          <p className="mt-1 text-slate-400">
            A privacy-first recovery platform connecting Owners, Finders, and Custodians.
          </p>
          <div className="mt-6 border-t border-slate-100 pt-4 text-slate-400">
            © 2026 FindIt. Built for campus safety and community recovery.
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultTab={authModalTab}
      />

      <LostReportModal
        isOpen={isLostModalOpen}
        onClose={() => setIsLostModalOpen(false)}
        onSuccess={() => {
          showToast('Lost item reported successfully!')
          loadFeed()
        }}
        onOpenSignIn={handleOpenSignIn}
        user={user}
      />

      <FoundReportModal
        isOpen={isFoundModalOpen}
        onClose={() => setIsFoundModalOpen(false)}
        onSuccess={() => {
          showToast('Found item reported with secure verification clues!')
          loadFeed()
        }}
        onOpenSignIn={handleOpenSignIn}
        user={user}
      />

      <ClaimModal
        isOpen={isClaimModalOpen}
        onClose={() => {
          setIsClaimModalOpen(false)
          setClaimTargetItem(null)
        }}
        item={claimTargetItem}
        onSuccess={() => {
          showToast('Ownership claim submitted for custodian review!')
          loadFeed()
        }}
        onOpenSignIn={handleOpenSignIn}
        user={user}
      />

    </div>
  )
}
