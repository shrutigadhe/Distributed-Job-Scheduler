import React, { useEffect, useState } from 'react';
import { projectsAPI, queuesAPI, jobsAPI } from '../api';
import { useToast } from '../components/Toast';
import {
  RefreshCw, Plus, RotateCcw, ChevronDown, Clock,
  CheckCircle, XCircle, Loader, AlertTriangle, X, Filter
} from 'lucide-react';

const STATUS_META = {
  queued:    { color:'#f59e0b', icon:<Clock size={12} />,         label:'Queued' },
  running:   { color:'#3b82f6', icon:<Loader size={12} />,        label:'Running' },
  completed: { color:'#10b981', icon:<CheckCircle size={12} />,   label:'Completed' },
  failed:    { color:'#ef4444', icon:<XCircle size={12} />,       label:'Failed' },
  scheduled: { color:'#8b5cf6', icon:<Clock size={12} />,         label:'Scheduled' },
  dead:      { color:'#6b7280', icon:<AlertTriangle size={12} />, label:'DLQ' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { color:'#6b7280', label: status };
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:600,
      background:`${m.color}18`, color:m.color, border:`1px solid ${m.color}30`
    }}>
      {m.icon}{m.label}
    </span>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth:520 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h3 style={{ fontSize:16, fontWeight:700, color:'white' }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:12, fontWeight:500, color:'var(--text-secondary)', marginBottom:6 }}>{label}</label>
      {children}
    </div>
  );
}

const RETRY_STRATEGIES = ['fixed', 'linear', 'exponential'];

const defaultForm = () => ({
  name:'', payload:'{}', priority:0,
  cron_expression:'', max_retries:3, retry_strategy:'fixed'
});

export default function JobsPage() {
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [queues, setQueues] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(defaultForm());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    projectsAPI.list().then(r => setProjects(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedProject) queuesAPI.list(selectedProject).then(r => setQueues(r.data)).catch(() => {});
    else setQueues([]);
    setSelectedQueue(null);
    setJobs([]);
  }, [selectedProject]);

  const loadJobs = async (queueId) => {
    if (!queueId) return;
    setLoading(true);
    try { const r = await jobsAPI.list(queueId); setJobs(r.data); } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!selectedQueue) return;
    loadJobs(selectedQueue.id);
    const id = setInterval(() => loadJobs(selectedQueue.id), 3000);
    return () => clearInterval(id);
  }, [selectedQueue]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let payload;
      try { payload = JSON.parse(form.payload); } catch { toast('Payload must be valid JSON', 'error'); setSaving(false); return; }
      await jobsAPI.create(selectedQueue.id, { ...form, payload });
      toast('Job created!', 'success');
      setShowModal(false);
      setForm(defaultForm());
      loadJobs(selectedQueue.id);
    } catch (err) {
      toast(err.response?.data?.detail || 'Failed to create job', 'error');
    } finally { setSaving(false); }
  };

  const retryJob = async (jobId) => {
    try { await jobsAPI.retry(jobId); toast('Job requeued', 'success'); loadJobs(selectedQueue.id); }
    catch { toast('Retry failed', 'error'); }
  };

  const filteredJobs = statusFilter === 'all' ? jobs : jobs.filter(j => j.status === statusFilter);

  const fmtDate = (d) => d ? new Date(d).toLocaleString() : '—';

  return (
    <div className="fade-up">
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'white', marginBottom:4 }}>Jobs</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)' }}>Browse and manage job executions per queue</p>
        </div>
        {selectedQueue && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={15} /> New Job
          </button>
        )}
      </div>

      {/* Filters row */}
      <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        {/* Project picker */}
        <div style={{ position:'relative', minWidth:180 }}>
          <select
            className="input"
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
            style={{ paddingRight:32, appearance:'none' }}
          >
            <option value="">Select project…</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown size={14} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }} />
        </div>

        {/* Queue picker */}
        <div style={{ position:'relative', minWidth:180 }}>
          <select
            className="input"
            value={selectedQueue?.id || ''}
            onChange={e => { const q = queues.find(x => x.id === e.target.value); setSelectedQueue(q || null); }}
            disabled={!selectedProject}
            style={{ paddingRight:32, appearance:'none', opacity: selectedProject ? 1 : 0.5 }}
          >
            <option value="">Select queue…</option>
            {queues.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
          </select>
          <ChevronDown size={14} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }} />
        </div>

        {/* Status filter */}
        <div style={{ display:'flex', gap:6, alignItems:'center', marginLeft:'auto' }}>
          <Filter size={13} style={{ color:'var(--text-muted)' }} />
          {['all', 'queued', 'running', 'completed', 'failed'].map(s => (
            <button key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding:'5px 11px', borderRadius:20, fontSize:12, fontWeight:500, border:'1px solid',
                cursor:'pointer', transition:'all 0.15s',
                background: statusFilter === s ? 'rgba(99,102,241,0.15)' : 'transparent',
                borderColor: statusFilter === s ? '#6366f1' : 'var(--border)',
                color: statusFilter === s ? '#818cf8' : 'var(--text-muted)',
              }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          {selectedQueue && (
            <button className="btn btn-ghost" style={{ padding:'5px 10px', marginLeft:4 }}
              onClick={() => loadJobs(selectedQueue.id)}>
              <RefreshCw size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {!selectedQueue ? (
        <div className="card empty-state" style={{ height:320 }}>
          <Clock size={36} style={{ color:'var(--text-muted)', marginBottom:12 }} />
          <p style={{ fontSize:14, color:'var(--text-muted)', fontWeight:500 }}>Select a project and queue to view jobs</p>
        </div>
      ) : loading && jobs.length === 0 ? (
        <div className="card empty-state" style={{ height:200 }}>
          <RefreshCw size={24} style={{ color:'var(--text-muted)', animation:'spin 1s linear infinite' }} />
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="card empty-state" style={{ height:200 }}>
          <p style={{ fontSize:14, color:'var(--text-muted)' }}>No jobs found</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Retries</th>
                <th>Cron</th>
                <th>Created</th>
                <th style={{ textAlign:'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map(job => (
                <tr key={job.id}>
                  <td>
                    <p style={{ fontWeight:600, color:'white', fontSize:13 }}>{job.name}</p>
                    <p style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'monospace', marginTop:2 }}>
                      {job.id.slice(0, 8)}…
                    </p>
                  </td>
                  <td><StatusBadge status={job.status} /></td>
                  <td>
                    <span style={{ fontSize:12, fontWeight:600, color: job.priority > 5 ? '#f59e0b' : 'var(--text-secondary)' }}>
                      P{job.priority}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize:12, color:'var(--text-secondary)' }}>
                      {job.retry_count}/{job.max_retries}
                    </span>
                  </td>
                  <td>
                    {job.cron_expression
                      ? <span style={{ fontSize:11, fontFamily:'monospace', color:'#a78bfa', background:'rgba(139,92,246,0.1)', padding:'2px 7px', borderRadius:4 }}>{job.cron_expression}</span>
                      : <span style={{ color:'var(--text-muted)', fontSize:12 }}>—</span>
                    }
                  </td>
                  <td style={{ fontSize:12, color:'var(--text-muted)' }}>{fmtDate(job.created_at)}</td>
                  <td style={{ textAlign:'right' }}>
                    {(job.status === 'failed' || job.status === 'dead') && (
                      <button className="btn btn-ghost" style={{ padding:'4px 10px', fontSize:12 }}
                        onClick={() => retryJob(job.id)}>
                        <RotateCcw size={12} /> Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Job Modal */}
      {showModal && (
        <Modal title="Create New Job" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <Field label="Job Name">
              <input className="input" required placeholder="Send welcome email"
                value={form.name} onChange={e => setForm(f => ({ ...f, name:e.target.value }))} />
            </Field>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Field label="Priority (0-10)">
                <input className="input" type="number" min={0} max={10}
                  value={form.priority} onChange={e => setForm(f => ({ ...f, priority:parseInt(e.target.value)||0 }))} />
              </Field>
              <Field label="Max Retries">
                <input className="input" type="number" min={0} max={10}
                  value={form.max_retries} onChange={e => setForm(f => ({ ...f, max_retries:parseInt(e.target.value)||0 }))} />
              </Field>
            </div>
            <Field label="Retry Strategy">
              <div style={{ position:'relative' }}>
                <select className="input" style={{ appearance:'none', paddingRight:32 }}
                  value={form.retry_strategy} onChange={e => setForm(f => ({ ...f, retry_strategy:e.target.value }))}>
                  {RETRY_STRATEGIES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                </select>
                <ChevronDown size={13} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }} />
              </div>
            </Field>
            <Field label="Cron Expression (optional — leave blank for immediate)">
              <input className="input" placeholder="e.g. 0 9 * * 1-5"
                value={form.cron_expression} onChange={e => setForm(f => ({ ...f, cron_expression:e.target.value }))} />
            </Field>
            <Field label="Payload (JSON)">
              <textarea className="input" rows={4} style={{ resize:'vertical', fontFamily:'monospace', fontSize:12 }}
                value={form.payload} onChange={e => setForm(f => ({ ...f, payload:e.target.value }))} />
            </Field>
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <button type="button" className="btn btn-ghost" style={{ flex:1 }} onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex:1 }}>
                {saving ? 'Creating…' : 'Create Job'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
