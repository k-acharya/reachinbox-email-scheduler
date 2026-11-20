import { Mail, LogOut, Users, Hash, CheckCircle2, ExternalLink } from 'lucide-react';
import { SlackStatus, User } from '../types';
import { API_BASE_URL, slackApi } from '../api/client';

interface NavbarProps {
  user: User;
  slackStatus: SlackStatus;
  senderCount: number;
  onOpenSenders: () => void;
  onLogout: () => void;
  onSlackDisconnected: () => void;
}

export function Navbar({
  user,
  slackStatus,
  senderCount,
  onOpenSenders,
  onLogout,
  onSlackDisconnected,
}: NavbarProps) {
  const handleDisconnectSlack = async () => {
    await slackApi.disconnect();
    onSlackDisconnected();
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">ReachInbox Scheduler</h1>
            <p className="text-xs text-slate-500">Distributed BullMQ &amp; Ethereal SMTP Engine</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Bull Board Queue Monitor Link */}
          <a
            href={`${API_BASE_URL}/admin/queues`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Queue Monitor
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          {/* Slack OAuth Connection Status */}
          {slackStatus.isConnected ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span className="font-medium">Slack: {slackStatus.teamName || 'Connected'}</span>
              <button
                type="button"
                onClick={handleDisconnectSlack}
                className="ml-1 text-emerald-700 underline hover:text-emerald-950"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <a
              href={slackApi.getConnectUrl()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Hash className="h-3.5 w-3.5 text-purple-600" />
              Connect Slack
            </a>
          )}

          {/* Multi-Sender Management Button */}
          <button
            type="button"
            onClick={onOpenSenders}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Users className="h-3.5 w-3.5 text-indigo-600" />
            Senders ({senderCount})
          </button>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="h-8 w-8 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="hidden text-left sm:block">
              <p className="text-xs font-medium text-slate-900">{user.name}</p>
              <p className="text-[11px] text-slate-500">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              title="Logout"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}