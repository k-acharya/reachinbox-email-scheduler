import { useEffect, useState, useCallback } from 'react';
import {
  Mail,
  Plus,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';
import { EmailRecord, Sender, SlackStatus, User } from './types';
import { authApi, emailsApi, sendersApi, slackApi } from './api/client';
import { Navbar } from './components/Navbar';
import { SendersModal } from './components/SendersModal';
import { ComposeModal } from './components/ComposeModal';
import { EmailTable } from './components/EmailTable';

type ActiveTab = 'scheduled' | 'sent';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [senders, setSenders] = useState<Sender[]>([]);
  const [slackStatus, setSlackStatus] = useState<SlackStatus>({ isConnected: false });

  const [activeTab, setActiveTab] = useState<ActiveTab>('scheduled');
  const [scheduledEmails, setScheduledEmails] = useState<EmailRecord[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailRecord[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EmailRecord[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [isSendersOpen, setIsSendersOpen] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  // Check session authentication on boot
  useEffect(() => {
    authApi
      .getMe()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  const refreshDashboardData = useCallback(async () => {
    if (!user) return;
    setEmailsLoading(true);
    try {
      const [sendersList, slack, scheduled, sent] = await Promise.all([
        sendersApi.list(),
        slackApi.getStatus(),
        emailsApi.listScheduled(),
        emailsApi.listSent(),
      ]);
      setSenders(sendersList);
      setSlackStatus(slack);
      setScheduledEmails(scheduled);
      setSentEmails(sent);
    } finally {
      setEmailsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshDashboardData();
      // Auto-poll every 5 seconds so live queue transitions update automatically
      const interval = setInterval(refreshDashboardData, 5000);
      return () => clearInterval(interval);
    }
  }, [user, refreshDashboardData]);

  // Debounced Elasticsearch search
  useEffect(() => {
    if (!user) return;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const hits = await emailsApi.search(trimmed);
        setSearchResults(hits);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, user]);

  const handleLogout = async () => {
    await authApi.logout();
    setUser(null);
  };

  const handleCancelEmail = async (id: string) => {
    await emailsApi.cancel(id);
    await refreshDashboardData();
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Unauthenticated Google OAuth Login Gate
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">ReachInbox Email Scheduler</h1>
          <p className="mt-2 text-sm text-slate-500">
            Production-grade distributed email scheduling with BullMQ, Redis rate limiting,
            Elasticsearch search, and Slack alerts.
          </p>
          <a
            href={authApi.getGoogleLoginUrl()}
            className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.7-.2-2.5H12v4.8h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M5.3 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.6 7.4C.6 9.4 0 11.6 0 14s.6 4.6 1.6 6.6l3.7-2.8z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 19.9 7.4 23 12 23z"
              />
            </svg>
            Continue with Google
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        user={user}
        slackStatus={slackStatus}
        senderCount={senders.length}
        onOpenSenders={() => setIsSendersOpen(true)}
        onLogout={handleLogout}
        onSlackDisconnected={refreshDashboardData}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Top Action Bar: Tabs, Elasticsearch Search, Refresh & Compose */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveTab('scheduled');
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === 'scheduled' && searchResults === null
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="h-4 w-4" />
              Scheduled Emails ({scheduledEmails.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveTab('sent');
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === 'sent' && searchResults === null
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              Sent Emails ({sentEmails.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Elasticsearch Search Input */}
            <div className="relative min-w-[250px] flex-1 sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search recipient, subject, body..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pr-8 pl-9 text-sm focus:border-indigo-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={refreshDashboardData}
              title="Refresh"
              className="rounded-xl border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsComposeOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Compose Email
            </button>
          </div>
        </div>

        {/* Main Content View */}
        {searchResults !== null ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-600">
                Elasticsearch results for &ldquo;{searchQuery}&rdquo; ({searchResults.length} found)
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs font-medium text-indigo-600 hover:underline"
              >
                Clear search
              </button>
            </div>
            <EmailTable
              emails={searchResults}
              loading={searching}
              emptyMessage={`No emails matched "${searchQuery}".`}
              onCancelEmail={handleCancelEmail}
            />
          </div>
        ) : activeTab === 'scheduled' ? (
          <EmailTable
            emails={scheduledEmails}
            loading={emailsLoading && scheduledEmails.length === 0}
            emptyMessage='No scheduled emails yet. Click "Compose Email" to schedule a batch.'
            onCancelEmail={handleCancelEmail}
          />
        ) : (
          <EmailTable
            emails={sentEmails}
            loading={emailsLoading && sentEmails.length === 0}
            emptyMessage="No sent emails yet. Scheduled jobs will appear here once delivered via Ethereal SMTP."
          />
        )}
      </main>

      <SendersModal
        isOpen={isSendersOpen}
        senders={senders}
        onClose={() => setIsSendersOpen(false)}
        onSendersChanged={refreshDashboardData}
      />

      <ComposeModal
        isOpen={isComposeOpen}
        senders={senders}
        onClose={() => setIsComposeOpen(false)}
        onScheduled={refreshDashboardData}
      />
    </div>
  );
}