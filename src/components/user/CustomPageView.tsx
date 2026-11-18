import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Mail, Send } from 'lucide-react';
import { createContactMessage } from '../../lib/firebase';
import type { CustomPage } from '../../types/streaming';
import { sanitizeHtml } from '../../utils/customization';

interface CustomPageViewProps {
  page: CustomPage | null;
  slug: string;
  onBackHome: () => void;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const CustomPageView: React.FC<CustomPageViewProps> = ({
  page,
  slug,
  onBackHome,
  onNotify,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  if (!page) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Page Not Found</h1>
        <p className="mt-2 text-sm text-zinc-500">
          No published page exists for &quot;{slug}&quot;.
        </p>
        <button
          type="button"
          onClick={onBackHome}
          className="mt-6 kv-primary-btn px-5 py-2.5 text-sm font-semibold"
        >
          Return Home
        </button>
      </div>
    );
  }

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      await createContactMessage({
        name,
        email,
        subject,
        message,
        pageSlug: page.slug,
      });
      setSent(true);
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
      onNotify('Your message has been sent to the team.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Unable to send message.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <button
        type="button"
        onClick={onBackHome}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-[var(--kv-accent,#e50914)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </button>

      <article className="kv-themed-surface kv-modal-radius border p-6 sm:p-10 shadow-sm">
        <h1 className="font-display text-3xl font-bold tracking-tight">{page.title}</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Last updated {new Date(page.updatedAt).toLocaleDateString()}
        </p>

        <div
          className="prose prose-sm mt-6 max-w-none leading-relaxed dark:prose-invert prose-headings:font-display prose-a:text-[var(--kv-accent,#e50914)]"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.contentHtml) }}
        />

        {page.showContactForm && (
          <div className="mt-10 border-t border-zinc-200/70 pt-8 dark:border-zinc-800">
            <div className="mb-4 flex items-center gap-2">
              <Mail className="h-5 w-5 text-[var(--kv-accent,#e50914)]" />
              <h2 className="font-display text-xl font-semibold">Send a Message</h2>
            </div>

            {sent ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-400">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>Thank you! Your inquiry is saved and will appear in our Admin Inbox.</span>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Your Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="kv-input-radius w-full border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="kv-input-radius w-full border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-zinc-500">Subject</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="kv-input-radius w-full border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-zinc-500">Message</label>
                  <textarea
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="kv-input-radius w-full border border-zinc-300 bg-transparent p-3 text-sm dark:border-zinc-700"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="kv-primary-btn inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {submitting ? 'Sending...' : 'Submit Message'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </article>
    </div>
  );
};
