import React, { useState } from 'react';
import { authAPI } from '../api';
import { useToast } from '../components/Toast';
import { Zap, Mail, Lock, Eye, EyeOff, ArrowRight, Activity, Shield, Layers } from 'lucide-react';

const features = [
  { icon: <Activity size={18} className="text-indigo-400" />, title: 'Real-time monitoring', desc: 'Track every job execution live' },
  { icon: <Shield size={18} className="text-violet-400" />, title: 'Atomic job claiming', desc: 'No duplicate executions, ever' },
  { icon: <Layers size={18} className="text-cyan-400" />, title: 'Smart retry engine', desc: 'Fixed, linear & exponential backoff' },
];

export default function LoginPage({ onLogin }) {
  const toast = useToast();
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast('Please fill in all fields', 'error'); return; }
    setLoading(true);
    try {
      if (tab === 'login') {
        const res = await authAPI.login(email, password);
        localStorage.setItem('token', res.data.access_token);
        toast('Welcome back!', 'success');
        onLogin();
      } else {
        await authAPI.register(email, password);
        toast('Account created! Please log in.', 'success');
        setTab('login');
      }
    } catch (err) {
      toast(err.response?.data?.detail || (tab === 'login' ? 'Login failed. Check your credentials.' : 'Registration failed.'), 'error');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>

      {/* Left panel — hero */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px', background: 'linear-gradient(160deg, #0d1525 0%, #0f0c29 100%)',
        borderRight: '1px solid var(--border)', position: 'relative', overflow: 'hidden'
      }}>
        {/* Decorative glow */}
        <div style={{ position: 'absolute', top: '30%', left: '20%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12), transparent 70%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '10%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1), transparent 70%)', filter: 'blur(30px)' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 56 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={20} color="white" />
            </div>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>JobFlow</span>
          </div>

          <h1 style={{ fontSize: 42, fontWeight: 800, color: 'white', lineHeight: 1.15, marginBottom: 16 }}>
            Distributed jobs,<br />
            <span style={{ background: 'linear-gradient(135deg,#6366f1,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              beautifully orchestrated.
            </span>
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 400, marginBottom: 48 }}>
            Schedule, monitor and manage background jobs at scale — with real-time insights, retry policies, and a Dead Letter Queue.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {features.map(f => (
              <div key={f.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ padding: 8, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', flexShrink: 0 }}>
                  {f.icon}
                </div>
                <div>
                  <p style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>{f.title}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{ width: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 56px', flexShrink: 0 }}>
        <div style={{ width: '100%' }} className="fade-up">

          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, color: 'white', marginBottom: 6 }}>
              {tab === 'login' ? 'Sign in to your account' : 'Create a new account'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              {tab === 'login' ? "Don't have an account? " : 'Already registered? '}
              <button onClick={() => setTab(tab === 'login' ? 'register' : 'login')}
                style={{ color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: 'Inter, sans-serif' }}>
                {tab === 'login' ? 'Register here' : 'Sign in'}
              </button>
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Email address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="you@example.com"
                  className="input" style={{ paddingLeft: 36 }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                  className="input" style={{ paddingLeft: 36, paddingRight: 36 }} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: 8, padding: '12px 18px', width: '100%' }}>
              {loading
                ? <div className="spin" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }} />
                : <><span>{tab === 'login' ? 'Sign In' : 'Create Account'}</span><ArrowRight size={15} /></>
              }
            </button>
          </form>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 32 }}>
            Distributed Job Scheduler · Built with FastAPI + React
          </p>
        </div>
      </div>
    </div>
  );
}
