import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../api';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, Cpu, Layers, Clock, CheckCircle, XCircle, Activity, Zap } from 'lucide-react';

const metrics_config = [
  { key: 'active_workers',  label: 'Active Workers',  icon: Cpu,           color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.2)' },
  { key: 'total_queues',    label: 'Total Queues',    icon: Layers,         color: '#6366f1', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.2)' },
  { key: 'jobs_queued',     label: 'Jobs Queued',     icon: Clock,          color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
  { key: 'jobs_running',    label: 'Running',         icon: Activity,       color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' },
  { key: 'jobs_completed',  label: 'Completed',       icon: CheckCircle,    color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
  { key: 'jobs_failed',     label: 'Failed',          icon: XCircle,        color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.2)' },
];

const PIE_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1e293b', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
      {label && <p style={{ color: 'var(--text-muted)', marginBottom: 6, fontSize: 12 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill, fontWeight: 600 }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const [metrics, setMetrics] = useState({ total_queues: 0, active_workers: 0, jobs_queued: 0, jobs_running: 0, jobs_completed: 0, jobs_failed: 0 });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const load = async () => {
      try { const r = await dashboardAPI.metrics(); setMetrics(r.data); } catch {}
    };
    load();
    const id = setInterval(() => { load(); setTick(t => t + 1); }, 5000);
    return () => clearInterval(id);
  }, []);

  const pieData = [
    { name: 'Queued', value: metrics.jobs_queued || 0 },
    { name: 'Running', value: metrics.jobs_running || 0 },
    { name: 'Completed', value: metrics.jobs_completed || 0 },
    { name: 'Failed', value: metrics.jobs_failed || 0 },
  ];

  const barData = [
    { name: 'Queued', jobs: metrics.jobs_queued, fill: '#f59e0b' },
    { name: 'Running', jobs: metrics.jobs_running, fill: '#3b82f6' },
    { name: 'Completed', jobs: metrics.jobs_completed, fill: '#10b981' },
    { name: 'Failed', jobs: metrics.jobs_failed, fill: '#ef4444' },
  ];

  const areaData = Array.from({ length: 8 }, (_, i) => ({
    time: `${i * 5}m`,
    completed: Math.max(0, Math.floor(metrics.jobs_completed * (0.6 + Math.random() * 0.5))),
    failed: Math.max(0, Math.floor(metrics.jobs_failed * (0.5 + Math.random() * 0.8))),
  }));

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 4 }}>Overview</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Live system metrics · refreshes every 5s
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', animation: 'pulse-dot 2s infinite' }} />
          <span style={{ fontSize: 12, color: '#34d399', fontWeight: 500 }}>Live</span>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {metrics_config.map(({ key, label, icon: Icon, color, bg, border }) => (
          <div key={key} className="metric-card" style={{ borderColor: border, background: bg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ padding: 8, borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Icon size={18} style={{ color }} />
              </div>
              <TrendingUp size={13} style={{ color: 'var(--text-muted)' }} />
            </div>
            <p style={{ fontSize: 34, fontWeight: 800, color: 'white', lineHeight: 1 }}>{metrics[key]}</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, fontWeight: 500 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
        {/* Bar chart */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>Job Status Distribution</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Current counts by status</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" stroke="transparent" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis stroke="transparent" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="jobs" radius={[6, 6, 0, 0]}>
                {barData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut chart */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>Breakdown</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} stroke="transparent" />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {pieData.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i] }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.name}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Area chart */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>Throughput Trend</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Simulated time-series based on current data</p>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {[{ color: '#10b981', label: 'Completed' }, { color: '#ef4444', label: 'Failed' }].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 3, borderRadius: 2, background: color }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={areaData}>
            <defs>
              <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gf" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="time" stroke="transparent" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
            <YAxis stroke="transparent" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="completed" name="Completed" stroke="#10b981" fill="url(#gc)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="failed" name="Failed" stroke="#ef4444" fill="url(#gf)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[
          { icon: <Zap size={16} style={{ color: '#f59e0b' }} />, title: 'Atomic Claiming', desc: 'Jobs are claimed using SELECT FOR UPDATE SKIP LOCKED — zero duplicates even with N workers.' },
          { icon: <Activity size={16} style={{ color: '#6366f1' }} />, title: 'Smart Retries', desc: 'Configurable retry strategies: fixed delay, linear backoff, or exponential backoff.' },
          { icon: <Layers size={16} style={{ color: '#10b981' }} />, title: 'Dead Letter Queue', desc: 'Jobs that exhaust retries automatically move to DLQ for manual inspection and replay.' },
        ].map(({ icon, title, desc }) => (
          <div key={title} className="card" style={{ padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              {icon}
              <p style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{title}</p>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
