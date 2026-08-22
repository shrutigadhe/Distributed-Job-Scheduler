import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../api';
import { Cpu, Activity, Clock, Zap, RefreshCw, Circle } from 'lucide-react';

function WorkerCard({ worker }) {
  const isOnline = worker.status === 'online' || worker.status === 'active';
  const lastSeen = worker.last_heartbeat
    ? new Date(worker.last_heartbeat).toLocaleTimeString()
    : '—';

  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'16px 20px', borderRadius:12,
      background: isOnline ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)',
      border:`1px solid ${isOnline ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
      transition:'all 0.2s'
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:14 }}>
        <div style={{ position:'relative' }}>
          <div style={{ width:40, height:40, borderRadius:12, background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Cpu size={18} style={{ color:'#818cf8' }} />
          </div>
          <div style={{
            position:'absolute', bottom:-2, right:-2, width:11, height:11,
            borderRadius:'50%', background: isOnline ? '#10b981' : '#6b7280',
            border:'2px solid var(--bg-secondary)'
          }} />
        </div>
        <div>
          <p style={{ fontSize:13, fontWeight:700, color:'white' }}>{worker.name}</p>
          <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
            ID: {worker.id?.slice(0,8)}… &nbsp;·&nbsp; Last seen: {lastSeen}
          </p>
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:16 }}>
        <div style={{ textAlign:'right' }}>
          <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:2 }}>Jobs run</p>
          <p style={{ fontSize:15, fontWeight:700, color:'white' }}>{worker.jobs_processed || 0}</p>
        </div>
        <span style={{
          display:'inline-flex', alignItems:'center', gap:5,
          padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:600,
          background: isOnline ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.12)',
          color: isOnline ? '#34d399' : '#9ca3af',
          border:`1px solid ${isOnline ? 'rgba(16,185,129,0.25)' : 'rgba(107,114,128,0.2)'}`
        }}>
          <Circle size={6} fill={isOnline ? '#34d399' : '#9ca3af'} stroke="none" />
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
    </div>
  );
}

const HOW_IT_WORKS = [
  {
    step:'01',
    title:'Register & Heartbeat',
    desc:'Workers register themselves in the database with a unique name and send heartbeat pings every 5 seconds to signal they\'re alive.',
    color:'#6366f1'
  },
  {
    step:'02',
    title:'Atomic Job Claiming',
    desc:'Workers poll for queued/scheduled jobs and atomically claim one using SQLite locking — guaranteeing no two workers run the same job.',
    color:'#8b5cf6'
  },
  {
    step:'03',
    title:'Execute & Report',
    desc:'The worker executes the job payload, records the result in JobExecution, and marks the job as completed or failed.',
    color:'#10b981'
  },
  {
    step:'04',
    title:'Retry & DLQ',
    desc:'On failure, workers apply the configured retry strategy (fixed / linear / exponential). After max retries, the job moves to the Dead Letter Queue.',
    color:'#f59e0b'
  },
];

export default function WorkersPage() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const r = await dashboardAPI.metrics();
      // metrics endpoint may not return worker list — handle gracefully
      setWorkers(r.data.workers || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  const online = workers.filter(w => w.status === 'online' || w.status === 'active').length;

  return (
    <div className="fade-up" style={{ display:'flex', flexDirection:'column', gap:24 }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'white', marginBottom:4 }}>Workers</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)' }}>
            Live view of background worker processes · refreshes every 3s
          </p>
        </div>
        <button className="btn btn-ghost" onClick={load} style={{ padding:'7px 14px', fontSize:12 }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
        {[
          { label:'Total Workers', value: workers.length, icon:<Cpu size={18} />, color:'#6366f1', bg:'rgba(99,102,241,0.1)', border:'rgba(99,102,241,0.2)' },
          { label:'Online', value: online, icon:<Activity size={18} />, color:'#10b981', bg:'rgba(16,185,129,0.1)', border:'rgba(16,185,129,0.2)' },
          { label:'Offline', value: workers.length - online, icon:<Clock size={18} />, color:'#6b7280', bg:'rgba(107,114,128,0.08)', border:'rgba(107,114,128,0.15)' },
        ].map(({ label, value, icon, color, bg, border }) => (
          <div key={label} className="metric-card" style={{ borderColor:border, background:bg }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
              <div style={{ padding:8, borderRadius:10, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ color }}>{icon}</span>
              </div>
            </div>
            <p style={{ fontSize:34, fontWeight:800, color:'white', lineHeight:1 }}>{value}</p>
            <p style={{ fontSize:12, color:'var(--text-secondary)', marginTop:6, fontWeight:500 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Worker list */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <p style={{ fontSize:14, fontWeight:600, color:'white' }}>Connected Workers</p>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#10b981' }} />
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>{online} active</span>
          </div>
        </div>

        <div style={{ padding:16, display:'flex', flexDirection:'column', gap:10 }}>
          {loading ? (
            <div className="empty-state" style={{ padding:48 }}>
              <RefreshCw size={24} style={{ color:'var(--text-muted)', animation:'spin 1s linear infinite' }} />
            </div>
          ) : workers.length === 0 ? (
            <div className="empty-state" style={{ padding:56 }}>
              <Cpu size={36} style={{ color:'var(--text-muted)', marginBottom:12 }} />
              <p style={{ fontSize:14, color:'var(--text-muted)', fontWeight:500 }}>No workers connected</p>
              <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:6, maxWidth:320, textAlign:'center', lineHeight:1.6 }}>
                Start a worker with: <code style={{ background:'rgba(255,255,255,0.06)', padding:'2px 6px', borderRadius:4 }}>python -m worker.worker_main</code>
              </p>
            </div>
          ) : (
            workers.map(w => <WorkerCard key={w.id} worker={w} />)
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="card" style={{ padding:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <Zap size={16} style={{ color:'#f59e0b' }} />
          <p style={{ fontSize:15, fontWeight:700, color:'white' }}>How Workers Operate</p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14 }}>
          {HOW_IT_WORKS.map(({ step, title, desc, color }) => (
            <div key={step} style={{ padding:18, borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <span style={{ fontSize:11, fontWeight:800, color, background:`${color}15`, padding:'3px 8px', borderRadius:6 }}>{step}</span>
                <p style={{ fontSize:13, fontWeight:600, color:'white' }}>{title}</p>
              </div>
              <p style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.65 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
