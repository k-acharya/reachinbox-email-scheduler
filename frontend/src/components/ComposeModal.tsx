import { useState, FormEvent, ChangeEvent } from 'react';
import { X, Upload, Send, Users } from 'lucide-react';
import { Sender } from '../types';
import { emailsApi } from '../api/client';

interface ComposeModalProps {
  isOpen: boolean;
  senders: Sender[];
  onClose: () => void;
  onScheduled: () => void;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function extractUniqueEmails(rawText: string): string[] {
  const matches = rawText.match(EMAIL_REGEX) || [];
  return Array.from(new Set(matches.map((e) => e.trim().toLowerCase())));
}

function defaultStartTimeLocal(): string {
  const d = new Date(Date.now() + 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function ComposeModal({
  isOpen,
  senders,
  onClose,
  onScheduled,
}: ComposeModalProps) {
  const activeSenders = senders.filter((s) => s.isActive);

  const [senderId, setSenderId] = useState(activeSenders[0]?.id || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [rawRecipients, setRawRecipients] = useState('');
  const [startTime, setStartTime] = useState(defaultStartTimeLocal);
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const parsedRecipients = extractUniqueEmails(rawRecipients);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '');
      const combined = rawRecipients ? `${rawRecipients}\n${content}` : content;
      const unique = extractUniqueEmails(combined);
      setRawRecipients(unique.join(', '));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const chosenSenderId = senderId || activeSenders[0]?.id;
    if (!chosenSenderId) {
      setError('Please select or create an active SMTP sender first.');
      return;
    }

    if (parsedRecipients.length === 0) {
      setError('Please enter or upload at least one valid recipient email address.');
      return;
    }

    setSubmitting(true);
    try {
      await emailsApi.schedule({
        senderId: chosenSenderId,
        subject: subject.trim(),
        body: body.trim(),
        recipients: parsedRecipients,
        startTime: new Date(startTime).toISOString(),
        delayMs: Math.max(0, Math.round(delaySeconds * 1000)),
        hourlyLimit: Number(hourlyLimit),
        idempotencyKey: crypto.randomUUID(),
      });

      setSubject('');
      setBody('');
      setRawRecipients('');
      onScheduled();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to schedule emails';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Compose &amp; Schedule Campaign</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && (
            <div className="rounded-lg bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          {/* Sender Selection */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">From Sender</label>
            {activeSenders.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                No active senders found. Click <strong>Senders</strong> in the top bar to add an
                Ethereal SMTP account first.
              </p>
            ) : (
              <select
                value={senderId || activeSenders[0]?.id}
                onChange={(e) => setSenderId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              >
                {activeSenders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Recipients + CSV / TXT Upload */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-700">
                Recipients (comma/newline separated or upload CSV/TXT)
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
                <Upload className="h-3.5 w-3.5 text-indigo-600" />
                Upload CSV / TXT
                <input
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
            <textarea
              rows={3}
              required
              placeholder="alice@example.com, bob@example.com"
              value={rawRecipients}
              onChange={(e) => setRawRecipients(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <Users className="h-3.5 w-3.5 text-indigo-600" />
              <span>
                Detected <strong>{parsedRecipients.length}</strong> unique valid recipient(s)
              </span>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Subject</label>
            <input
              type="text"
              required
              placeholder="Quick question regarding Q4 growth"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Body */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Email Body</label>
            <textarea
              rows={5}
              required
              placeholder="Hi there,&#10;&#10;We would love to connect..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Scheduling & Throttling Controls */}
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Start Time</label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Delay Between Emails (sec)
              </label>
              <input
                type="number"
                min={0}
                step={0.5}
                required
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Hourly Limit / Sender
              </label>
              <input
                type="number"
                min={1}
                required
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || activeSenders.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {submitting
                ? 'Scheduling...'
                : `Schedule ${parsedRecipients.length || ''} Email${
                    parsedRecipients.length === 1 ? '' : 's'
                  }`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}