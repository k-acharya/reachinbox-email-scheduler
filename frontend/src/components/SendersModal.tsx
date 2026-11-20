import { useState, FormEvent } from 'react';
import { X, Plus, Trash2, CheckCircle2, XCircle, Server } from 'lucide-react';
import { Sender } from '../types';
import { sendersApi } from '../api/client';

interface SendersModalProps {
  isOpen: boolean;
  senders: Sender[];
  onClose: () => void;
  onSendersChanged: () => void;
}

export function SendersModal({
  isOpen,
  senders,
  onClose,
  onSendersChanged,
}: SendersModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [smtpHost, setSmtpHost] = useState('smtp.ethereal.email');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddSender = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await sendersApi.create({
        name: name.trim(),
        email: email.trim(),
        smtpHost: smtpHost.trim(),
        smtpPort: Number(smtpPort),
        smtpUsername: smtpUsername.trim(),
        smtpPassword,
      });
      setName('');
      setEmail('');
      setSmtpUsername('');
      setSmtpPassword('');
      onSendersChanged();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to create sender';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (sender: Sender) => {
    await sendersApi.update(sender.id, { isActive: !sender.isActive });
    onSendersChanged();
  };

  const handleDelete = async (id: string) => {
    await sendersApi.remove(id);
    onSendersChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-slate-900">Manage SMTP Senders</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* Add New Sender Form */}
          <form
            onSubmit={handleAddSender}
            className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Add Ethereal SMTP Sender</h3>
              <a
                href="https://ethereal.email/create"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-indigo-600 hover:underline"
              >
                Generate Free Ethereal Account &rarr;
              </a>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="Outreach Team"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Sender Email</label>
                <input
                  type="email"
                  required
                  placeholder="sender@ethereal.email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">SMTP Host</label>
                <input
                  type="text"
                  required
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">SMTP Port</label>
                <input
                  type="number"
                  required
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">SMTP Username</label>
                <input
                  type="text"
                  required
                  placeholder="user@ethereal.email"
                  value={smtpUsername}
                  onChange={(e) => setSmtpUsername(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  SMTP Password (AES-256 Encrypted)
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {submitting ? 'Encrypting & Saving...' : 'Add Sender'}
              </button>
            </div>
          </form>

          {/* Existing Senders List */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">
              Configured Senders ({senders.length})
            </h3>
            {senders.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No senders configured yet. Add an Ethereal SMTP sender above to start scheduling.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                {senders.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-4 p-3.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">{s.name}</span>
                        <span className="text-xs text-slate-500">&lt;{s.email}&gt;</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {s.smtpHost}:{s.smtpPort} &bull; User: {s.smtpUsername}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(s)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                          s.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {s.isActive ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Active
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3.5 w-3.5" /> Inactive
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete sender"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}