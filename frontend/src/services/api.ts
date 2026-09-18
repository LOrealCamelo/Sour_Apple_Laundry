import axios from 'axios';

const api = axios.create({

  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',

});

api.interceptors.request.use((config) => {

  const token = localStorage.getItem('token');

  if (token) {

    config.headers.Authorization = `Bearer ${token}`;

  }

  return config;

});

export const orderService = {

  create: (data: any) => api.post('/orders', data),

  getHistory: () => api.get('/orders'),

  reportPayment: (id: string, method: string) => api.post(`/orders/${id}/report-payment`, { method }),

};

