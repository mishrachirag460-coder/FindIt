
import { useState } from 'react'
import { supabase } from './supabase'

function App() {
  const [showLostForm, setShowLostForm] = useState(false)
  const [showFoundForm, setShowFoundForm] = useState(false)

  const [submitted, setSubmitted] = useState(false)
  const [foundSubmitted, setFoundSubmitted] = useState(false)
  const [foundError, setFoundError] = useState(null)

  // Save Lost Report to Supabase
  const handleLostSubmit = async (event) => {
    event.preventDefault()

    const form = event.currentTarget
    const formData = new FormData(form)

    const lostReport = {
      item_name: formData.get('item_name'),
      category: formData.get('category'),
      description: formData.get('description'),
      lost_location: formData.get('lost_location'),
      lost_date: formData.get('lost_date'),
    }

    const { error } = await supabase
      .from('lost_reports')
      .insert([lostReport])

    if (error) {
      console.error('Database Error:', error.message)
      alert('Report save nahi hui: ' + error.message)
      return
    }

    setSubmitted(true)
    form.reset()
  }

  // Save Found Report to Supabase
  const handleFoundSubmit = async (event) => {
    event.preventDefault()
    setFoundError(null)

    const form = event.currentTarget
    const formData = new FormData(form)

    const foundReport = {
      item_name: formData.get('item_name'),
      category: formData.get('category'),
      description: formData.get('description'),
      found_location: formData.get('found_location'),
      found_date: formData.get('found_date'),
      current_custody: formData.get('current_custody'),
    }

    const { error } = await supabase
      .from('found_reports')
      .insert([foundReport])

    if (error) {
      console.error('Database Error:', error.message)
      setFoundError('Report save nahi hui: ' + error.message)
      return
    }

    setFoundSubmitted(true)
    form.reset()
  }

  const openLostForm = () => {
    setShowLostForm(true)
    setShowFoundForm(false)
    setSubmitted(false)
  }

  const openFoundForm = () => {
    setShowFoundForm(true)
    setShowLostForm(false)
    setFoundSubmitted(false)
    setFoundError(null)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">

      {/* Navbar */}
      <nav className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5 md:px-16">
        <h1 className="text-2xl font-bold text-blue-700">
          FindIt<span className="text-slate-900">.</span>
        </h1>

        <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <a href="#" className="hover:text-blue-700">Home</a>
          <a href="#how-it-works" className="hover:text-blue-700">How It Works</a>
          <a href="#report" className="hover:text-blue-700">Report an Item</a>
        </div>

        <button
          onClick={openLostForm}
          className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Get Started
        </button>
      </nav>

      {/* Hero Section */}
      <section className="px-6 py-20 md:px-16 md:py-28">
        <div className="mx-auto max-w-5xl text-center">

          <span className="inline-block rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
            Campus Item Recovery System
          </span>

          <h2 className="mt-7 text-4xl font-bold leading-tight md:text-6xl">
            Lost Something on Campus?
            <span className="block text-blue-700">
              Let's Find It Together.
            </span>
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
            FindIt connects students, teachers and campus staff
            to make lost and found item recovery easier,
            safer and more organised.
          </p>

          <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row">

            <button
              onClick={openLostForm}
              className="rounded-xl bg-blue-700 px-7 py-4 font-semibold text-white hover:bg-blue-800"
            >
              Report Lost Item →
            </button>

            <button
              onClick={openFoundForm}
              className="rounded-xl border border-slate-300 bg-white px-7 py-4 font-semibold text-slate-800 hover:bg-slate-100"
            >
              Report Found Item
            </button>

          </div>

          <p className="mt-5 text-sm text-slate-500">
            One campus. One connected recovery system.
          </p>

        </div>
      </section>

      {/* Lost Item Form */}
      {showLostForm && (
        <section className="px-6 py-12 md:px-16">
          <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">

            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Report a Lost Item</h2>

              <button
                type="button"
                onClick={() => setShowLostForm(false)}
                className="text-2xl text-slate-500 hover:text-red-600"
              >
                ×
              </button>
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Provide details to help identify your missing item.
            </p>

            <form onSubmit={handleLostSubmit} className="mt-8 space-y-5">

              <div>
                <label className="mb-2 block font-medium">Item Name</label>
                <input
                  type="text"
                  name="item_name"
                  placeholder="e.g. Black water bottle"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">Category</label>
                <select
                  name="category"
                  required
                  defaultValue=""
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                >
                  <option value="" disabled>Select category</option>
                  <option>Electronics</option>
                  <option>Books & Stationery</option>
                  <option>Water Bottles</option>
                  <option>Bags</option>
                  <option>Accessories</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block font-medium">Description</label>
                <textarea
                  name="description"
                  placeholder="Describe your item..."
                  rows="3"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">Lost Location</label>
                <input
                  type="text"
                  name="lost_location"
                  placeholder="e.g. College Library"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">Lost Date</label>
                <input
                  type="date"
                  name="lost_date"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-blue-700 px-6 py-3 font-semibold text-white hover:bg-blue-800"
              >
                Submit Lost Report
              </button>

              {submitted && (
                <p className="rounded-lg bg-green-100 p-4 text-green-700">
                  Lost report successfully saved to FindIt!
                </p>
              )}

            </form>
          </div>
        </section>
      )}

      {/* Found Item Form - Not connected to database yet */}
      {showFoundForm && (
        <section className="px-6 py-12 md:px-16">
          <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">

            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Report a Found Item</h2>

              <button
                type="button"
                onClick={() => setShowFoundForm(false)}
                className="text-2xl text-slate-500 hover:text-red-600"
              >
                ×
              </button>
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Provide details about the item you found on campus.
            </p>

            <form onSubmit={handleFoundSubmit} className="mt-8 space-y-5">

              <div>
                <label className="mb-2 block font-medium">Item Name</label>
                <input
                  type="text"
                  name="item_name"
                  placeholder="e.g. Blue college bag"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">Category</label>
                <select
                  name="category"
                  required
                  defaultValue=""
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                >
                  <option value="" disabled>Select category</option>
                  <option>Electronics</option>
                  <option>Books & Stationery</option>
                  <option>Water Bottles</option>
                  <option>Bags</option>
                  <option>Accessories</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block font-medium">Description</label>
                <textarea
                  name="description"
                  placeholder="Describe the found item..."
                  rows="3"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">Found Location</label>
                <input
                  type="text"
                  name="found_location"
                  placeholder="e.g. College Library"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">Found Date</label>
                <input
                  type="date"
                  name="found_date"
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-2 block font-medium">Current Custody</label>
                <select
                  name="current_custody"
                  required
                  defaultValue=""
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                >
                  <option value="" disabled>Select current custody</option>
                  <option>I have the item</option>
                  <option>Handed over to a teacher</option>
                  <option>Handed over to HOD office</option>
                  <option>Handed over to college office</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-blue-700 px-6 py-3 font-semibold text-white hover:bg-blue-800"
              >
                Submit Found Report
              </button>

              {foundSubmitted && (
                <p className="rounded-lg bg-green-100 p-4 text-green-700">
                  Found report successfully saved to FindIt!
                </p>
              )}

              {foundError && (
                <p className="rounded-lg bg-red-100 p-4 text-red-700">
                  {foundError}
                </p>
              )}

            </form>
          </div>
        </section>
      )}

      {/* Report Cards */}
      <section id="report" className="px-6 pb-20 md:px-16">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-3xl">🔍</div>
            <h3 className="mt-5 text-xl font-bold">I Lost Something</h3>
            <p className="mt-3 leading-7 text-slate-600">
              Submit a lost item report and help others identify
              your missing belongings.
            </p>
            <button
              onClick={openLostForm}
              className="mt-6 font-semibold text-blue-700"
            >
              Report Lost Item →
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-3xl">📦</div>
            <h3 className="mt-5 text-xl font-bold">I Found Something</h3>
            <p className="mt-3 leading-7 text-slate-600">
              Report a found item and help its rightful owner
              recover it through a coordinated process.
            </p>
            <button
              onClick={openFoundForm}
              className="mt-6 font-semibold text-blue-700"
            >
              Report Found Item →
            </button>
          </div>

        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-white px-6 py-20 md:px-16">
        <div className="mx-auto max-w-5xl text-center">

          <h2 className="text-3xl font-bold md:text-4xl">
            How FindIt Works
          </h2>

          <p className="mt-4 text-slate-600">
            A simple process to reconnect people with their belongings.
          </p>

          <div className="mt-12 grid gap-10 md:grid-cols-3">

            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700">
                01
              </div>
              <h3 className="mt-5 font-bold">Report</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Submit details about a lost or found item.
              </p>
            </div>

            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700">
                02
              </div>
              <h3 className="mt-5 font-bold">Connect</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Find possible matches and coordinate recovery.
              </p>
            </div>

            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700">
                03
              </div>
              <h3 className="mt-5 font-bold">Recover</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Verify ownership and confirm the item's return.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 px-6 py-8 text-center text-sm text-slate-400">
        <p className="text-lg font-bold text-white">FindIt.</p>
        <p className="mt-2">Making campus recovery simpler and organised.</p>
        <p className="mt-5">© 2026 FindIt. Campus Item Recovery System.</p>
      </footer>

    </div>
  )
}

export default App
