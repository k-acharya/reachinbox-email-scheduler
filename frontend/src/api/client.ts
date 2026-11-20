import axios from 'axios';
import { EmailRecord, EmailStatus, Sender, SlackStatus, User } from '../types';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const authApi = {
  getMe: async (): Promise<User> => {
    const { data } = await apiClient.get('/api/auth/me');
    return data.user;
  },
  logout: async (): Promise<void> => {
    await apiClient.post('/api/auth/logout');
  },
  getGoogleLoginUrl: () => `${API_BASE_URL}/api/auth/google`,
};

export const sendersApi = {
  list: async (): Promise<Sender[]> => {
    const { data } = await apiClient.get('/api/senders');
    return data.senders;
  },
  create: async (payload: {
    name: string;
    email: string;
    smtpHost: string;
    smtpPort: number;
    smtpUsername: string;
    smtpPassword: string;
  }): Promise<Sender> => {
    const { data } = await apiClient.post('/api/senders', payload);
    return data.sender;
  },
  update: async (id: string, payload: Partial<Sender> & { smtpPassword?: string }): Promise<Sender> => {
    const { data } = await apiClient.patch(`/api/senders/${id}`, payload);
    return data.sender;
  },
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/senders/${id}`);
  },
};

export const emailsApi = {
  schedule: async (payload: {
    senderId: string;
    subject: string;
    body: string;
    recipients: string[];
    startTime: string;
    delayMs: number;
    hourlyLimit: number;
    idempotencyKey: string;
  }): Promise<{ duplicate: boolean; count: number; emails: EmailRecord[] }> => {
    const { data } = await apiClient.post('/api/emails/schedule', payload);
    return data;
  },
  listScheduled: async (): Promise<EmailRecord[]> => {
    const { data } = await apiClient.get('/api/emails/scheduled');
    return data.emails;
  },
  listSent: async (): Promise<EmailRecord[]> => {
    const { data } = await apiClient.get('/api/emails/sent');
    return data.emails;
  },
  search: async (query: string, status?: EmailStatus): Promise<EmailRecord[]> => {
    const { data } = await apiClient.get('/api/emails/search', {
      params: { q: query, ...(status && { status }) },
    });
    return data.emails;
  },
  cancel: async (id: string): Promise<EmailRecord> => {
    const { data } = await apiClient.post(`/api/emails/${id}/cancel`);
    return data.email;
  },
};

export const slackApi = {
  getStatus: async (): Promise<SlackStatus> => {
    const { data } = await apiClient.get('/api/slack/status');
    return data.slack;
  },
  disconnect: async (): Promise<void> => {
    await apiClient.post('/api/slack/disconnect');
  },
  getConnectUrl: () => `${API_BASE_URL}/api/slack/connect`,
};