import React, { useEffect, useState, useCallback } from 'react';
import { projectsAPI, queuesAPI, jobsAPI } from '../api';
import { useToast } from '../components/Toast';
import {
  RefreshCw, Plus, RotateCcw, ChevronDown, Clock,
  CheckCircle, XCircle, Loader, AlertTriangle, X, Filter,
  Search, ChevronLeft, ChevronRight, FileText, Layers
} from 'lucide-react';

const STATUS_META = {
  queued:    { color:'#f59e0b', icon:<Clock size={12} />,         label:'Queued' },
  claimed:   { color:'#3b82f6', icon:<Loader size={12} />,        label:'Running' },
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

function Modal({ title, onClose, children, maxWidth = 520 }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth }} onClick={e => e.stopPropagation()}>
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

/* ─── Execution Log Modal ─────────────────────────── */
function ExecutionLogModal({ job, onClose }) {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    jobsAPI.executions(job.id)
      .then(r => setExecutions(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [job.id]);

  const fmtDate = d => d ? new Date(d).toLocaleString() : '—';
  const durationSec = (e) => {
    if (!e.started_at || !e.completed_at) return '—';
    const ms = new Date(e.completed_at) - new Date(e.started_at);
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <Modal title={`Execution Log — ${job.name}`} onClose={onClose} maxWidth={680}>
      <div style={{ marginBottom:12, display:'flex', gap:10, flexWrap:'wrap' }}>
        <span style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'monospace' }}>{job.id}</span>
        <StatusBadge status={job.status} />
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>Loading…</div>
      ) : executions.length === 0 ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)', fontSize:13 }}>No executions recorded yet.</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {executions.map((e, i) => {
            const isOk = e.status === 'completed';
            const col = isOk ? '#10b981' : '#ef4444';
            return (
              <div key={e.id} style={{ padding:14, borderRadius:10, border:`1px solid ${col}30`, background:`${col}08` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:col, background:`${col}15`, padding:'2px 8px', borderRadius:6 }}>
                      Attempt #{e.attempt_number}
                    </span>
                    <StatusBadge status={e.status} />
                  </div>
                  <span style={{ fontSize:11, color:'var(--text-muted)' }}>Duration: {durationSec(e)}</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:11, color:'var(--text-secondary)' }}>
                  <span>Started: {fmtDate(e.started_at)}</span>
                  <span>Ended: {fmtDate(e.completed_at)}</span>
                  {e.worker_id && <span style={{ gridColumn:'1/-1' }}>Worker: <code style={{ fontFamily:'monospace', color:'#818cf8' }}>{e.worker_id?.slice(0,8)}…</code></span>}
                </div>
                {e.error_message && (
                  <div style={{ marginTop:8, padding:'8px 10px', borderRadius:6, background:'rgba(239,68,68,0.1)', fontSize:11, fontFamily:'monospace', color:'#f87171', wordBreak:'break-all' }}>
                    {e.error_message}
                  </div>
                )}
                {e.log_output && (
                  <div style={{ marginTop:8, padding:'8px 10px', borderRadius:6, background:'rgba(255,255,255,0.04)', fontSize:11, fontFamily:'monospace', color:'var(--text-secondary)' }}>
                    {e.log_output}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/* ─── Batch Submit Modal ─────────────────────────── */
function BatchModal({ queues, onClose, onSuccess }) {
  const toast = useToast();
  const [queueId, setQueueId] = useState('');
  const [rawJobs, setRawJobs] = useState(`[
  {
    "name": "Successful Job Example",
    "payload": {
      "task": "send_welcome_email",
      "user_email": "hello@example.com"
    },
    "priority": 5,
    "max_retries": 3,
    "retry_strategy": "exponential"
  },
  {
    "name": "Failed Job Example (Tests Retries & DLQ)",
    "payload": {
      "task": "sync_analytics",
      "force_fail": "API Rate Limit Exceeded"
    },
    "priority": 1,
    "max_retries": 2,
    "retry_strategy": "linear"
  }
]`);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    let jobs;
    try { jobs = JSON.parse(rawJobs); } catch { toast('Jobs must be a valid JSON array', 'error'); return; }
    if (!Array.isArray(jobs)) { toast('Jobs must be an array', 'error'); return; }
    setSaving(true);
    try {
      const r = await jobsAPI.batch({ queue_id: queueId, jobs });
      toast(`Batch submitted — ${r.data.count} jobs created (batch: ${r.data.batch_id.slice(0,8)}…)`, 'success');
      onSuccess();
      onClose();
    } catch (err) {
      toast(err.response?.data?.detail || 'Batch submit failed', 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal title="Submit Batch Jobs" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <Field label="Target Queue">
          <select className="input" required value={queueId} onChange={e => setQueueId(e.target.value)} style={{ appearance:'none' }}>
            <option value="">Select a queue…</option>
            {queues.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
          </select>
        </Field>
        <Field label="Jobs (JSON Array)">
          <textarea className="input" rows={8} style={{ resize:'vertical', fontFamily:'monospace', fontSize:12 }}
            value={rawJobs} onChange={e => setRawJobs(e.target.value)} />
        </Field>
        <div style={{ display:'flex', gap:10, marginTop:4 }}>
          <button type="button" className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving || !queueId} className="btn btn-primary" style={{ flex:1 }}>
            {saving ? 'Submitting…' : 'Submit Batch'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ─── Main Page ─────────────────────────── */
export default function JobsPage() {
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [queues, setQueues] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  const [selectedProject, setSelectedProject] = useState('');
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [logJob, setLogJob] = useState(null);
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

  const loadJobs = useCallback(async (pg = page) => {
    setLoading(true);
    try {
      const params = { page: pg, limit: LIMIT };
      if (selectedQueue) params.queue_id = selectedQueue.id;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchQ.trim()) params.q = searchQ.trim();
      const r = await jobsAPI.search(params);
      setJobs(r.data.items);
      setTotal(r.data.total);
    } catch {}
    finally { setLoading(false); }
  }, [selectedQueue, statusFilter, searchQ, page]);

  useEffect(() => { setPage(1); }, [selectedQueue, statusFilter, searchQ]);

  useEffect(() => {
    loadJobs(page);
    const id = setInterval(() => loadJobs(page), 4000);
    return () => clearInterval(id);
  }, [loadJobs, page]);

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
      loadJobs(1);
    } catch (err) {
      toast(err.response?.data?.detail || 'Failed to create job', 'error');
    } finally { setSaving(false); }
  };

  const retryJob = async (jobId) => {
    try { await jobsAPI.retry(jobId); toast('Job requeued', 'success'); loadJobs(page); }
    catch { toast('Retry failed', 'error'); }
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const fmtDate = (d) => d ? new Date(d).toLocaleString() : '—';

  return (
    <div className="fade-up">
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'white', marginBottom:4 }}>Jobs</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)' }}>Search, filter and manage all job executions · {total} total</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {queues.length > 0 && (
            <button className="btn btn-ghost" onClick={() => setShowBatch(true)} style={{ fontSize:12 }}>
              <Layers size={13} /> Batch Submit
            </button>
          )}
          {selectedQueue && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={15} /> New Job
            </button>
          )}
        </div>
      </div>

      {/* Filters row */}
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        {/* Search */}
        <div style={{ position:'relative', flex:'0 0 220px' }}>
          <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
          <input className="input" placeholder="Search job name or ID…"
            style={{ paddingLeft:30 }}
            value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        </div>

        {/* Project picker */}
        <div style={{ position:'relative', minWidth:160 }}>
          <select className="input" value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={{ paddingRight:32, appearance:'none' }}>
            <option value="">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown size={14} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }} />
        </div>

        {/* Queue picker */}
        <div style={{ position:'relative', minWidth:160 }}>
          <select className="input" value={selectedQueue?.id || ''}
            onChange={e => { const q = queues.find(x => x.id === e.target.value); setSelectedQueue(q || null); }}
            disabled={!selectedProject}
            style={{ paddingRight:32, appearance:'none', opacity: selectedProject ? 1 : 0.5 }}>
            <option value="">All queues</option>
            {queues.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
          </select>
          <ChevronDown size={14} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }} />
        </div>

        {/* Status pills */}
        <div style={{ display:'flex', gap:5, alignItems:'center', marginLeft:'auto' }}>
          <Filter size={12} style={{ color:'var(--text-muted)' }} />
          {['all','queued','running','completed','failed','scheduled'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:500, border:'1px solid',
              cursor:'pointer', transition:'all 0.15s',
              background: statusFilter === s ? 'rgba(99,102,241,0.15)' : 'transparent',
              borderColor: statusFilter === s ? '#6366f1' : 'var(--border)',
              color: statusFilter === s ? '#818cf8' : 'var(--text-muted)',
            }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <button className="btn btn-ghost" style={{ padding:'5px 10px', marginLeft:4 }} onClick={() => loadJobs(page)}>
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Table */}
      {loading && jobs.length === 0 ? (
        <div className="card empty-state" style={{ height:200 }}>
          <RefreshCw size={24} style={{ color:'var(--text-muted)', animation:'spin 1s linear infinite' }} />
        </div>
      ) : jobs.length === 0 ? (
        <div className="card empty-state" style={{ height:220 }}>
          <Clock size={36} style={{ color:'var(--text-muted)', marginBottom:12 }} />
          <p style={{ fontSize:14, color:'var(--text-muted)', fontWeight:500 }}>No jobs found</p>
          <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>Try adjusting your filters or create a new job</p>
        </div>
      ) : (
        <>
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
                {jobs.map(job => (
                  <tr key={job.id} style={{ cursor:'pointer' }} onClick={() => setLogJob(job)}>
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
                    <td style={{ textAlign:'right' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display:'flex', justifyContent:'flex-end', gap:4 }}>
                        <button className="btn btn-ghost" style={{ padding:'4px 8px', fontSize:11 }}
                          onClick={() => setLogJob(job)}>
                          <FileText size={11} /> Logs
                        </button>
                        {(job.status === 'failed' || job.status === 'dead') && (
                          <button className="btn btn-ghost" style={{ padding:'4px 8px', fontSize:11 }}
                            onClick={() => retryJob(job.id)}>
                            <RotateCcw size={11} /> Retry
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12, padding:'0 4px' }}>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
            </span>
            <div style={{ display:'flex', gap:6 }}>
              <button className="btn btn-ghost" style={{ padding:'5px 10px', fontSize:12 }}
                onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={13} /> Prev
              </button>
              <span style={{ fontSize:12, color:'var(--text-muted)', alignSelf:'center', padding:'0 4px' }}>
                {page} / {totalPages}
              </span>
              <button className="btn btn-ghost" style={{ padding:'5px 10px', fontSize:12 }}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Next <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      {logJob && <ExecutionLogModal job={logJob} onClose={() => setLogJob(null)} />}
      {showBatch && <BatchModal queues={queues} onClose={() => setShowBatch(false)} onSuccess={() => loadJobs(1)} />}

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
            <Field label="Cron Expression (optional)">
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
