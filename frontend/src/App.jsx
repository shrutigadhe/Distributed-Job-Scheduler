import React, { useState, useEffect } from 'react';
import { ToastProvider } from './components/Toast';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import JobsPage from './pages/JobsPage';
import WorkersPage from './pages/WorkersPage';
import { authAPI } from './api';
import {
  LayoutDashboard, FolderOpen, Briefcase, Cpu,
  Zap, LogOut, ChevronRight
} from 'lucide-react';

const NAV = [
  { id:'dashboard', label:'Dashboard',    icon:LayoutDashboard },
  { id:'projects',  label:'Projects',     icon:FolderOpen },
  { id:'jobs',      label:'Jobs',         icon:Briefcase },
  { id:'workers',   label:'Workers',      icon:Cpu },
];

function Sidebar({ page, setPage, onLogout }) {
  return (
    <aside style={{
      width:220, flexShrink:0, display:'flex', flexDirection:'column',
      background:'var(--bg-secondary)', borderRight:'1px solid var(--border)',
      height:'100vh', position:'sticky', top:0
    }}>
      {/* Logo */}
      <div style={{ padding:'20px 18px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Zap size={16} color="white" />
        </div>
        <div>
          <p style={{ fontSize:14, fontWeight:700, color:'white', lineHeight:1.1 }}>JobFlow</p>
          <p style={{ fontSize:10, color:'var(--text-muted)' }}>Scheduler</p>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:'10px 10px' }}>
        {NAV.map(({ id, label, icon:Icon }) => (
          <button key={id}
            onClick={() => setPage(id)}
            className={`nav-item${page === id ? ' active' : ''}`}
            style={{ width:'100%', marginBottom:2 }}
          >
            <Icon size={16} />
            <span>{label}</span>
            {page === id && <ChevronRight size={13} style={{ marginLeft:'auto', opacity:0.5 }} />}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding:'12px 10px', borderTop:'1px solid var(--border)' }}>
        <button onClick={onLogout} className="nav-item" style={{ width:'100%', color:'var(--text-muted)' }}>
          <LogOut size={15} />
          <span>Logout</span>
        </button>
        <p style={{ fontSize:10, color:'var(--text-muted)', textAlign:'center', marginTop:10, opacity:0.6 }}>
          Distributed Job Scheduler v1.0
        </p>
      </div>
    </aside>
  );
}

function AppShell() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [page, setPage] = useState('dashboard');

  useEffect(() => {
    if (!token) return;
    authAPI.me().catch(() => { localStorage.removeItem('token'); setToken(null); });
  }, [token]);

  const handleLogin = () => setToken(localStorage.getItem('token'));
  const handleLogout = () => { localStorage.removeItem('token'); setToken(null); };

  if (!token) return <LoginPage onLogin={handleLogin} />;

  const PAGES = {
    dashboard: <DashboardPage />,
    projects:  <ProjectsPage />,
    jobs:      <JobsPage />,
    workers:   <WorkersPage />,
  };

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg-primary)' }}>
      <Sidebar page={page} setPage={setPage} onLogout={handleLogout} />
      <main style={{ flex:1, padding:'28px 32px', overflowY:'auto', minWidth:0 }}>
        {PAGES[page]}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}
