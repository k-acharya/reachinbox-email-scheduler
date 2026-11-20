import { Clock, CheckCircle2, AlertCircle, Loader2, ExternalLink, Ban } from 'lucide-react';
import { EmailRecord } from '../types';

interface EmailTableProps {
  emails: EmailRecord[];
  loading: boolean;
  emptyMessage: string;
  onCancelEmail?: (id: string) => void;
}

function StatusBadge({ status }: { status: EmailRecord['status'] }) {
  switch (status) {
    case 'scheduled':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
          <Clock className="h-3 w-3" /> Scheduled
        </span>
      );
    case 'processing':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
          <Loader2 className="h-3 w-3 animate-spin" /> Processing
        </span>
      );
    case 'sent':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          <CheckCircle2 className="h-3 w-3" /> Sent
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
          <AlertCircle className="h-3 w-3" /> Failed
        </span>
      );
  }
}

export function EmailTable({
  emails,
  loading,
  emptyMessage,
  onCancelEmail,
}: EmailTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        <span className="ml-2 text-sm text-slate-600">Loading emails...</span>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Recipient</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Sender</th>
              <th className="px-4 py-3">Scheduled / Sent Time</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Details / Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {emails.map((email) => (
              <tr key={email.id} className="hover:bg-slate-50/80">
                <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-900">
                  {email.recipient}
                </td>
                <td className="max-w-xs truncate px-4 py-3.5 text-slate-700" title={email.subject}>
                  {email.subject}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-600">
                  {email.sender?.email || '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-600">
                  {email.sentAt
                    ? new Date(email.sentAt).toLocaleString()
                    : new Date(email.scheduledAt).toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5">
                  <StatusBadge status={email.status} />
                  {email.lastError && (
                    <p
                      className="mt-1 max-w-[200px] truncate text-[11px] text-red-600"
                      title={email.lastError}
                    >
                      {email.lastError}
                    </p>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right text-xs">
                  {email.previewUrl && (
                    <a
                      href={email.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      Ethereal Preview <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {email.status === 'scheduled' && onCancelEmail && (
                    <button
                      type="button"
                      onClick={() => onCancelEmail(email.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                      <Ban className="h-3 w-3" /> Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}