import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { onAuth, getSuperAdminExists, getUserProfile } from './firebase'
import { Spinner } from './shared.jsx'
import Setup from './Setup'
import AuthScreen from './Auth'
import SuperAdminDashboard from './SuperAdminDashboard'
import AdminDashboard from './AdminDashboard'
import ClassTracker from './ClassTracker'

function App() {
  const [user, setUser]               = useState(undefined)  // undefined = still checking
  const [profile, setProfile]         = useState(null)
  const [superAdminExists, setSuperAdminExists] = useState(null) // null = still checking
  const [checking, setChecking]       = useState(true)

  // Step 1: Check if super admin has ever been set up
  useEffect(() => {
    getSuperAdminExists().then(exists => {
      setSuperAdminExists(exists)
    })
  }, [])

  // Step 2: Listen for auth state
  useEffect(() => {
    const unsub = onAuth(async (u) => {
      setUser(u)
      if (u) {
        const p = await getUserProfile(u.uid)
        setProfile(p)
      } else {
        setProfile(null)
      }
      setChecking(false)
    })
    return unsub
  }, [])

  // Still loading either check
  if (checking || superAdminExists === null) {
    return (
      <div style={{ minHeight:"100vh", background:"#F7F5F0", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:34, height:34, borderRadius:"50%", border:"3px solid #E5E5E5", borderTopColor:"#4ECDC4", animation:"spin 0.8s linear infinite" }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  // No super admin yet — show one-time setup
  if (!superAdminExists) return <Setup />

  // Not logged in
  if (!user) return <AuthScreen />

  // Logged in but no profile yet (just signed up via invite, consuming invite sets profile)
  if (!profile) return <Spinner text="Setting up your account…"/>

  // Route by role
  switch (profile.role) {
    case "superadmin": return <SuperAdminDashboard user={user} profile={profile} />
    case "admin":      return <AdminDashboard      user={user} profile={profile} />
    case "teacher":    return <ClassTracker        user={user} profile={profile} />
    default:
      // Logged in but no role assigned yet (edge case — show waiting screen)
      return (
        <div style={{ minHeight:"100vh", background:"#F7F5F0", fontFamily:"Georgia,serif", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ textAlign:"center", maxWidth:360 }}>
            <div style={{ fontSize:44, marginBottom:12 }}>⏳</div>
            <h2 style={{ margin:"0 0 8px", fontSize:20, fontWeight:600, color:"#1A1A1A" }}>Account pending</h2>
            <p style={{ color:"#888", fontSize:14, lineHeight:1.6 }}>Your account exists but hasn't been assigned a role yet. Please ask your administrator to invite you using your email address.</p>
          </div>
        </div>
      )
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
)
