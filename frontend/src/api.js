import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authAPI = {
  register: (email, password) => api.post('/auth/register', { email, password }),
  login: (email, password) => {
    const form = new URLSearchParams();
    form.append('username', email);
    form.append('password', password);
    return api.post('/auth/login', form);
  },
  me: () => api.get('/auth/me'),
};

export const projectsAPI = {
  list:   ()         => api.get('/projects/'),
  create: (data)     => api.post('/projects/', data),
  delete: (id)       => api.delete(`/projects/${id}`),
};

export const queuesAPI = {
  list:   (projectId)       => api.get(`/queues/${projectId}`),
  create: (projectId, data) => api.post(`/queues/${projectId}`, data),
  update: (queueId, data)   => api.patch(`/queues/${queueId}`, data),
  pause:  (queueId)         => api.post(`/queues/${queueId}/pause`),
  resume: (queueId)         => api.post(`/queues/${queueId}/resume`),
  delete: (queueId)         => api.delete(`/queues/${queueId}`),
  stats:  (queueId)         => api.get(`/queues/${queueId}/stats`),
};

export const jobsAPI = {
  list:       (queueId)       => api.get(`/jobs/${queueId}`),
  create:     (queueId, data) => api.post(`/jobs/${queueId}`, data),
  retry:      (jobId)         => api.post(`/jobs/${jobId}/retry`),
  batch:      (data)          => api.post('/jobs/batch', data),
  search:     (params)        => api.get('/jobs/', { params }),
  executions: (jobId)         => api.get(`/jobs/${jobId}/executions`),
};

export const dashboardAPI = {
  metrics: () => api.get('/dashboard/metrics'),
};

export default api;
