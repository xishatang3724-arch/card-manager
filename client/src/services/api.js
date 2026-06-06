import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000, // 60s — OCR can be slow
});

export async function getCards(params = {}) {
  const res = await api.get('/cards', { params });
  return res.data;
}

export async function getCard(id) {
  const res = await api.get(`/cards/${id}`);
  return res.data;
}

export async function uploadCard(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/upload', formData);
  return res.data;
}

export async function updateCard(id, data) {
  const res = await api.put(`/cards/${id}`, data);
  return res.data;
}

export async function deleteCard(id) {
  const res = await api.delete(`/cards/${id}`);
  return res.data;
}

// Resume APIs
export async function getResumes(params = {}) {
  const res = await api.get('/resumes', { params });
  return res.data;
}

export async function getResume(id) {
  const res = await api.get(`/resumes/${id}`);
  return res.data;
}

export async function uploadResume(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/resume/upload', formData);
  return res.data;
}

export async function updateResume(id, data) {
  const res = await api.put(`/resumes/${id}`, data);
  return res.data;
}

export async function deleteResume(id) {
  const res = await api.delete(`/resumes/${id}`);
  return res.data;
}
