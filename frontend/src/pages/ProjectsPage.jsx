import React, { useEffect, useState } from 'react';
import { projectsAPI, queuesAPI } from '../api';
import { useToast } from '../components/Toast';
import {
  FolderOpen, Plus, Trash2, Pause, Play,
  ChevronRight, Layers, AlertCircle, X
} from 'lucide-react';

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
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

export default function ProjectsPage() {
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [queues, setQueues] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [projectForm, setProjectForm] = useState({ name:'', description:'' });
  const [queueForm, setQueueForm] = useState({ name:'', max_workers:1 });
  const [saving, setSaving] = useState(false);

  const loadProjects = async () => {
    try { const r = await projectsAPI.list(); setProjects(r.data); } catch {}
  };

  const loadQueues = async (projectId) => {
    try { const r = await queuesAPI.list(projectId); setQueues(r.data); } catch {}
  };

  useEffect(() => { loadProjects(); }, []);

  const selectProject = (p) => {
    setSelectedProject(p);
    loadQueues(p.id);
  };

  const createProject = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await projectsAPI.create(projectForm);
      toast('Project created!', 'success');
      setShowProjectModal(false);
      setProjectForm({ name:'', description:'' });
      loadProjects();
    } catch (err) {
      toast(err.response?.data?.detail || 'Failed to create project', 'error');
    } finally { setSaving(false); }
  };

  const deleteProject = async (id) => {
    try {
      await projectsAPI.delete(id);
      toast('Project deleted', 'success');
      if (selectedProject?.id === id) { setSelectedProject(null); setQueues([]); }
      loadProjects();
    } catch { toast('Failed to delete', 'error'); }
  };

  const createQueue = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await queuesAPI.create(selectedProject.id, queueForm);
      toast('Queue created!', 'success');
      setShowQueueModal(false);
      setQueueForm({ name:'', max_workers:1 });
      loadQueues(selectedProject.id);
    } catch (err) {
      toast(err.response?.data?.detail || 'Failed to create queue', 'error');
    } finally { setSaving(false); }
  };

  const toggleQueue = async (q) => {
    try {
      if (q.is_paused) await queuesAPI.resume(q.id);
      else await queuesAPI.pause(q.id);
      toast(`Queue ${q.is_paused ? 'resumed' : 'paused'}`, 'success');
      loadQueues(selectedProject.id);
    } catch { toast('Failed to toggle queue', 'error'); }
  };

  const deleteQueue = async (id) => {
    try {
      await queuesAPI.delete(id);
      toast('Queue deleted', 'success');
      loadQueues(selectedProject.id);
    } catch { toast('Failed to delete queue', 'error'); }
  };

  return (
    <div className="fade-up">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'white', marginBottom:4 }}>Projects & Queues</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)' }}>Organise your jobs into projects and priority queues</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowProjectModal(true)}>
          <Plus size={15} /> New Project
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:16, minHeight:480 }}>
        {/* Project list */}
        <div className="card" style={{ padding:0, overflow:'hidden', alignSelf:'start' }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)' }}>
            <p style={{ fontSize:13, fontWeight:600, color:'var(--text-secondary)' }}>
              {projects.length} Project{projects.length !== 1 ? 's' : ''}
            </p>
          </div>

          {projects.length === 0 ? (
            <div className="empty-state" style={{ padding:40 }}>
              <FolderOpen size={32} style={{ color:'var(--text-muted)', marginBottom:10 }} />
              <p style={{ fontSize:13, color:'var(--text-muted)' }}>No projects yet</p>
            </div>
          ) : (
            projects.map(p => (
              <div key={p.id}
                onClick={() => selectProject(p)}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'12px 18px', cursor:'pointer', borderBottom:'1px solid var(--border)',
                  background: selectedProject?.id === p.id ? 'rgba(99,102,241,0.1)' : 'transparent',
                  transition:'background 0.15s'
                }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background: selectedProject?.id === p.id ? '#6366f1' : 'var(--text-muted)', flexShrink:0 }} />
                  <div style={{ minWidth:0 }}>
                    <p style={{ fontSize:13, fontWeight:600, color:'white', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</p>
                    {p.description && <p style={{ fontSize:11, color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.description}</p>}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
                  <ChevronRight size={14} style={{ color:'var(--text-muted)' }} />
                  <button onClick={e => { e.stopPropagation(); deleteProject(p.id); }}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:2, borderRadius:4, display:'flex' }}
                    title="Delete project">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Queue panel */}
        <div>
          {!selectedProject ? (
            <div className="card empty-state" style={{ height:320 }}>
              <Layers size={36} style={{ color:'var(--text-muted)', marginBottom:12 }} />
              <p style={{ fontSize:14, color:'var(--text-muted)', fontWeight:500 }}>Select a project to manage its queues</p>
            </div>
          ) : (
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 20px', borderBottom:'1px solid var(--border)' }}>
                <div>
                  <p style={{ fontSize:14, fontWeight:600, color:'white' }}>{selectedProject.name}</p>
                  <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{queues.length} queue{queues.length !== 1 ? 's' : ''}</p>
                </div>
                <button className="btn btn-primary" style={{ padding:'7px 14px', fontSize:12 }} onClick={() => setShowQueueModal(true)}>
                  <Plus size={13} /> New Queue
                </button>
              </div>

              {queues.length === 0 ? (
                <div className="empty-state" style={{ padding:60 }}>
                  <Layers size={32} style={{ color:'var(--text-muted)', marginBottom:10 }} />
                  <p style={{ fontSize:13, color:'var(--text-muted)' }}>No queues yet — create one to start scheduling jobs</p>
                </div>
              ) : (
                <div style={{ padding:16, display:'flex', flexDirection:'column', gap:10 }}>
                  {queues.map(q => (
                    <div key={q.id} style={{
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'14px 18px', borderRadius:10,
                      background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)'
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{ width:10, height:10, borderRadius:'50%', background: q.is_paused ? '#f59e0b' : '#10b981' }} />
                        <div>
                          <p style={{ fontSize:13, fontWeight:600, color:'white' }}>{q.name}</p>
                          <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                            Concurrency: {q.concurrency_limit} &nbsp;·&nbsp;
                            <span style={{ color: q.is_paused ? '#f59e0b' : '#10b981' }}>
                              {q.is_paused ? 'Paused' : 'Active'}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <button onClick={() => toggleQueue(q)}
                          className={`btn ${q.is_paused ? 'btn-secondary' : 'btn-ghost'}`}
                          style={{ padding:'5px 10px', fontSize:12 }}>
                          {q.is_paused ? <><Play size={12} /> Resume</> : <><Pause size={12} /> Pause</>}
                        </button>
                        <button onClick={() => deleteQueue(q.id)}
                          className="btn btn-danger" style={{ padding:'5px 10px', fontSize:12 }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Project modal */}
      {showProjectModal && (
        <Modal title="New Project" onClose={() => setShowProjectModal(false)}>
          <form onSubmit={createProject} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <Field label="Project Name">
              <input className="input" required placeholder="My Awesome Project"
                value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name:e.target.value }))} />
            </Field>
            <Field label="Description (optional)">
              <input className="input" placeholder="What this project does"
                value={projectForm.description} onChange={e => setProjectForm(f => ({ ...f, description:e.target.value }))} />
            </Field>
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <button type="button" className="btn btn-ghost" style={{ flex:1 }} onClick={() => setShowProjectModal(false)}>Cancel</button>
              <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex:1 }}>
                {saving ? 'Creating…' : 'Create Project'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Queue modal */}
      {showQueueModal && (
        <Modal title="New Queue" onClose={() => setShowQueueModal(false)}>
          <form onSubmit={createQueue} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <Field label="Queue Name">
              <input className="input" required placeholder="e.g. high-priority"
                value={queueForm.name} onChange={e => setQueueForm(f => ({ ...f, name:e.target.value }))} />
            </Field>
            <Field label="Concurrency Limit (max parallel jobs)">
              <input className="input" type="number" min={1} max={50}
                value={queueForm.max_workers} onChange={e => setQueueForm(f => ({ ...f, max_workers:parseInt(e.target.value)||1 }))} />
            </Field>
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <button type="button" className="btn btn-ghost" style={{ flex:1 }} onClick={() => setShowQueueModal(false)}>Cancel</button>
              <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex:1 }}>
                {saving ? 'Creating…' : 'Create Queue'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
