export interface User {
  id: string;
  googleId: string;
  name: string;
  email: string;
  avatar: string | null;
}

export interface Sender {
  id: string;
  userId: string;
  name: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed';

export interface EmailRecord {
  id: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt: string | null;
  status: EmailStatus;
  bullmqJobId: string | null;
  previewUrl: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  sender: {
    id: string;
    name: string;
    email: string;
  };
}

export interface SlackStatus {
  isConnected: boolean;
  id?: string;
  workspaceId?: string;
  teamName?: string;
  connectedAt?: string;
}