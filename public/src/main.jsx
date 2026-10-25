import React, { useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY)
const fmt = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
const hm = m => (m >= 60 ? Math.floor(m / 60) + ' ঘ ' + (m % 60) + ' মি' : m + ' মি')
const ROLE = { student: 'স্টুডেন্ট', teacher: 'শিক্ষক', admin: 'অ্যাডমিন' }

function Auth() {
  const [mode, setMode] = useState('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function go() {
    setErr('')
    setBusy(true)
    const r =
      mode === 'in'
        ? await sb.auth.signInWithPassword({ email, password: pw })
        : await sb.auth.signUp({ email, password: pw, options: { data: { name } } })
    setBusy(false)
    if (r.error) setErr(r.error.message)
  }
  return (
    <div className="wrap">
      <h1 className="c">📚 স্টাডি গ্রুপ</h1>
      <div className="card">
        {mode === 'up' && (
          <>
            <label>আপনার নাম</label>
            <input value={name} onChange={e => setName(e.target.value)} />
          </>
        )}
        <label>ইমেইল</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <label>পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)</label>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} />
        {err && <div className="err">{err}</div>}
        <button className="p" style={{ width: '100%' }} disabled={busy} onClick={go}>
          {mode === 'in' ? 'লগইন' : 'সাইন-আপ'}
        </button>
        <p className="c mu" onClick={() => setMode(mode === 'in' ? 'up' : 'in')} style={{ cursor: 'pointer' }}>
          {mode === 'in' ? 'নতুন? অ্যাকাউন্ট খুলুন' : 'অ্যাকাউন্ট আছে? লগইন করুন'}
        </p>
      </div>
    </div>
  )
}

function Rank({ k }) {
  const [b, setB] = useState([])
  useEffect(() => {
    sb.rpc('weekly_leaderboard').then(({ data }) => setB(data || []))
  }, [k])
  return (
    <div className="card">
      <h2>সাপ্তাহিক র‍্যাংকিং</h2>
      {b.length === 0 && <div className="mu">এখনও কেউ নেই</div>}
      {b.map((x, i) => (
        <div key={i} className={'rk' + (x.is_me ? ' me' : '')}>
          <span>
            {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}. {x.name}
          </span>
          <span className="mu">{hm(x.minutes)}</span>
        </div>
      ))}
    </div>
  )
}

function Study({ uid }) {
  const [cf, setCf] = useState(25)
  const [cb, setCb] = useState(5)
  const [mode, setMode] = useState('focus')
  const [left, setLeft] = useState(1500)
  const [run, setRun] = useState(false)
  const [streak, setStreak] = useState(0)
  const [today, setToday] = useState(0)
  const end = useRef(0)
  const m = useRef('focus')
  const c = useRef({ f: 25, b: 5 })

  async function load() {
    const a = await sb.rpc('my_streak')
    setStreak(a.data || 0)
    const t = Date.now() + 6 * 3600e3
    const start = Math.floor(t / 864e5) * 864e5 - 6 * 3600e3
    const s = await sb.from('sessions').select('minutes').eq('user_id', uid).gte('created_at', new Date(start).toISOString())
    setToday((s.data || []).reduce((x, y) => x + y.minutes, 0))
  }
  useEffect(() => {
    load()
  }, [])

  async function finish() {
    setRun(false)
    if (navigator.vibrate) navigator.vibrate([200, 100, 200])
    if (m.current === 'focus') {
      await sb.from('sessions').insert({ minutes: c.current.f })
      m.current = 'break'
      setMode('break')
      setLeft(c.current.b * 60)
      load()
    } else {
      m.current = 'focus'
      setMode('focus')
      setLeft(c.current.f * 60)
    }
  }
  useEffect(() => {
    if (!run) return
    const i = setInterval(() => {
      const l = Math.max(0, Math.round((end.current - Date.now()) / 1000))
      setLeft(l)
      if (l <= 0) {
        clearInterval(i)
        finish()
      }
    }, 500)
    return () => clearInterval(i)
  }, [run])

  function toggle() {
    if (!run) end.current = Date.now() + left * 1000
    setRun(!run)
  }
  function reset() {
    setRun(false)
    setLeft((m.current === 'focus' ? c.current.f : c.current.b) * 60)
  }
  function setCfg(f, b) {
    f = Math.min(180, Math.max(1, parseInt(f) || 25))
    b = Math.min(60, Math.max(1, parseInt(b) || 5))
    c.current = { f, b }
    setCf(f)
    setCb(b)
    reset()
  }

  return (
    <>
      <div className="card">
        <div className="c mu">{mode === 'focus' ? '🎯 ফোকাস সময়' : '☕ বিরতি'}</div>
        <div className="ring">{fmt(left)}</div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="p" onClick={toggle}>{run ? 'বিরতি দিন' : 'শুরু করুন'}</button>
          <button onClick={reset}>রিসেট</button>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <div>
            <label>ফোকাস (মিনিট)</label>
            <input type="number" value={cf} onChange={e => setCfg(e.target.value, cb)} />
          </div>
          <div>
            <label>বিরতি (মিনিট)</label>
            <input type="number" value={cb} onChange={e => setCfg(cf, e.target.value)} />
          </div>
        </div>
        <div className="mu c">টেস্ট করতে ফোকাস ১ মিনিট দিন। শুধু সম্পূর্ণ ফোকাস সেশন গোনা হয়।</div>
      </div>
      <div className="card">
        <h2>আপনার অগ্রগতি</h2>
        <div className="stats">
          <div className="stat"><b>🔥 {streak}</b><span className="mu">দিনের স্ট্রিক</span></div>
          <div className="stat"><b>{hm(today)}</b><span className="mu">আজকের পড়া</span></div>
        </div>
      </div>
    </>
  )
}

function App() {
  const [ses, setSes] = useState(undefined)
  const [pr, setPr] = useState(null)
  const [tab, setTab] = useState('study')
  const [k, setK] = useState(0)

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSes(data.session))
    const { data: l } = sb.auth.onAuthStateChange((_e, s) => setSes(s))
    return () => l.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!ses) {
      setPr(null)
      return
    }
    sb.from('profiles').select('*').eq('id', ses.user.id).single().then(({ data }) => {
      setPr(data)
      setTab(data && data.role === 'student' ? 'study' : 'rank')
    })
  }, [ses && ses.user.id])

  if (ses === undefined || (ses && !pr)) return <div className="wrap">লোড হচ্ছে...</div>
  if (!ses) return <Auth />
  const staff = pr.role !== 'student'

  return (
    <div className="wrap">
      <div className="top">
        <div>
          <b>{pr.name}</b> <span className="mu">· {ROLE[pr.role]}</span>
        </div>
        <button onClick={() => sb.auth.signOut()}>লগআউট</button>
      </div>
      <div className="tabs">
        {!staff && <button className={tab === 'study' ? 'on' : ''} onClick={() => setTab('study')}>⏱ পড়া</button>}
        <button className={tab === 'rank' ? 'on' : ''} onClick={() => { setK(k + 1); setTab('rank') }}>🏆 র‍্যাংকিং</button>
      </div>
      {tab === 'study' && !staff && <Study uid={ses.user.id} />}
      {tab === 'rank' && <Rank k={k} />}
      {staff && (
        <div className="card">
          <h2>শিক্ষক প্যানেল</h2>
          <div className="mu">রিসোর্স আপলোড, কুইজ ও পরীক্ষা পরের ধাপে যোগ হবে।</div>
        </div>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
