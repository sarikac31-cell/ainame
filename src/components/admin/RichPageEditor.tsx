import React, { useRef, useState } from 'react';
import {
  Archive,
  Bold,
  Check,
  Eye,
  FileText,
  Heading2,
  Heading3,
  Inbox,
  Italic,
  Link2,
  List,
  Plus,
  Quote,
  Save,
  Trash2,
} from 'lucide-react';
import type { ContactMessage, CustomPage } from '../../types/streaming';
import { formatRelativeTime, slugify } from '../../utils/catalog';
import { sanitizeHtml } from '../../utils/customization';

interface RichPageEditorProps {
  pages: CustomPage[];
  messages: ContactMessage[];
  onSavePage: (page: CustomPage, isNew: boolean) => Promise<void>;
  onDeletePage: (pageId: string) => Promise<void>;
  onUpdateMessageStatus: (id: string, status: 'unread' | 'read' | 'archived') => Promise<void>;
  onDeleteMessage: (id: string) => Promise<void>;
}

export const RichPageEditor: React.FC<RichPageEditorProps> = ({
  pages,
  messages,
  onSavePage,
  onDeletePage,
  onUpdateMessageStatus,
  onDeleteMessage,
}) => {
  const [subView, setSubView] = useState<'pages' | 'inbox'>('pages');
  const [selectedId, setSelectedId] = useState<string>(pages[0]?.id ?? 'new');
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedPage = pages.find((p) => p.id === selectedId) ?? null;

  const [title, setTitle] = useState(selectedPage?.title ?? 'New Information Page');
  const [slug, setSlug] = useState(selectedPage?.slug ?? 'new-page');
  const [contentHtml, setContentHtml] = useState(
    selectedPage?.contentHtml ?? '<h2>Section Title</h2><p>Write your page content here.</p>'
  );
  const [showContactForm, setShowContactForm] = useState(selectedPage?.showContactForm ?? false);
  const [status, setStatus] = useState<'published' | 'draft'>(selectedPage?.status ?? 'published');
  const [showInFooter, setShowInFooter] = useState(selectedPage?.showInFooter ?? true);
  const [slugDirty, setSlugDirty] = useState(false);

  const loadPage = (page: CustomPage | null) => {
    if (!page) {
      setSelectedId('new');
      setTitle('');
      setSlug('');
      setContentHtml('<h2>Heading</h2><p>Start writing...</p>');
      setShowContactForm(false);
      setStatus('published');
      setShowInFooter(true);
      setSlugDirty(false);
      return;
    }
    setSelectedId(page.id);
    setTitle(page.title);
    setSlug(page.slug);
    setContentHtml(page.contentHtml);
    setShowContactForm(page.showContactForm);
    setStatus(page.status);
    setShowInFooter(page.showInFooter);
    setSlugDirty(true);
  };

  const wrapSelection = (before: string, after: string, placeholder: string) => {
    const el = textareaRef.current;
    if (!el) {
      setContentHtml((c) => `${c}\n${before}${placeholder}${after}`);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = contentHtml.slice(start, end) || placeholder;
    const next = contentHtml.slice(0, start) + before + selected + after + contentHtml.slice(end);
    setContentHtml(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = slugify(slug || title || 'page');
    if (!title.trim() || !cleanSlug) return;
    setSaving(true);
    try {
      const isNew = selectedId === 'new' || !pages.some((p) => p.id === selectedId);
      const id = isNew ? `page-${cleanSlug}` : selectedId;
      const next: CustomPage = {
        id,
        title: title.trim(),
        slug: cleanSlug,
        contentHtml: sanitizeHtml(contentHtml),
        showContactForm,
        status,
        showInFooter,
        updatedAt: new Date().toISOString(),
      };
      await onSavePage(next, isNew);
      setSelectedId(id);
    } finally {
      setSaving(false);
    }
  };

  const unreadCount = messages.filter((m) => m.status === 'unread').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-zinc-200 p-1 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setSubView('pages')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${
              subView === 'pages'
                ? 'bg-[var(--kv-accent,#e50914)] text-white'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Custom Pages ({pages.length})
          </button>
          <button
            type="button"
            onClick={() => setSubView('inbox')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${
              subView === 'inbox'
                ? 'bg-[var(--kv-accent,#e50914)] text-white'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Inbox className="h-3.5 w-3.5" />
            Contact Inbox ({unreadCount} unread)
          </button>
        </div>

        {subView === 'pages' && (
          <button
            type="button"
            onClick={() => loadPage(null)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <Plus className="h-3.5 w-3.5" />
            New Page
          </button>
        )}
      </div>

      {subView === 'pages' ? (
        <div className="grid gap-5 lg:grid-cols-4">
          <div className="space-y-2">
            {pages.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => loadPage(p)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedId === p.id
                    ? 'border-[var(--kv-accent,#e50914)] bg-[var(--kv-accent,#e50914)]/10'
                    : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-bold">{p.title}</span>
                  <span
                    className={`text-[10px] font-semibold uppercase ${
                      p.status === 'published' ? 'text-emerald-500' : 'text-amber-500'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-[11px] text-zinc-500">#/page/{p.slug}</p>
              </button>
            ))}
          </div>

          <form onSubmit={handleSave} className="space-y-4 lg:col-span-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Page Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!slugDirty) setSlug(slugify(e.target.value));
                  }}
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">URL Slug (#/page/...)</label>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => {
                    setSlugDirty(true);
                    setSlug(slugify(e.target.value));
                  }}
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 font-mono text-xs dark:border-zinc-700"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <label className="flex items-center gap-2">
                <span className="text-zinc-500">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'published' | 'draft')}
                  className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </label>

              <label className="flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={showInFooter}
                  onChange={(e) => setShowInFooter(e.target.checked)}
                  className="accent-[var(--kv-accent,#e50914)]"
                />
                <span>Show link in footer</span>
              </label>

              <label className="flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={showContactForm}
                  onChange={(e) => setShowContactForm(e.target.checked)}
                  className="accent-[var(--kv-accent,#e50914)]"
                />
                <span>Attach Contact Form (writes to Firestore Inbox)</span>
              </label>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-100/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => wrapSelection('<h2>', '</h2>', 'Section Heading')}
                    className="rounded p-1.5 text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    title="Heading 2"
                  >
                    <Heading2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => wrapSelection('<h3>', '</h3>', 'Subheading')}
                    className="rounded p-1.5 text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    title="Heading 3"
                  >
                    <Heading3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => wrapSelection('<strong>', '</strong>', 'bold text')}
                    className="rounded p-1.5 text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    title="Bold"
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => wrapSelection('<em>', '</em>', 'italic text')}
                    className="rounded p-1.5 text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    title="Italic"
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => wrapSelection('<ul>\n  <li>', '</li>\n</ul>', 'List item')}
                    className="rounded p-1.5 text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    title="Bullet List"
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => wrapSelection('<blockquote>', '</blockquote>', 'Quoted note')}
                    className="rounded p-1.5 text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    title="Blockquote"
                  >
                    <Quote className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => wrapSelection('<a href="https://example.com">', '</a>', 'Link text')}
                    className="rounded p-1.5 text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    title="Link"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewMode((p) => !p)}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1 text-[11px] font-semibold dark:border-zinc-700"
                >
                  <Eye className="h-3 w-3" />
                  {previewMode ? 'Edit HTML' : 'Sanitized Preview'}
                </button>
              </div>

              {previewMode ? (
                <div
                  className="prose prose-sm max-w-none p-4 dark:prose-invert min-h-[220px]"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(contentHtml) }}
                />
              ) : (
                <textarea
                  ref={textareaRef}
                  rows={10}
                  value={contentHtml}
                  onChange={(e) => setContentHtml(e.target.value)}
                  className="w-full bg-transparent p-3.5 font-mono text-xs leading-relaxed focus:outline-none"
                />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              {selectedId !== 'new' && pages.some((p) => p.id === selectedId) ? (
                <button
                  type="button"
                  onClick={async () => {
                    await onDeletePage(selectedId);
                    loadPage(pages.find((p) => p.id !== selectedId) ?? null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Page
                </button>
              ) : (
                <span />
              )}

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--kv-accent,#e50914)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Save Page'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 p-8 text-center text-xs text-zinc-500 dark:border-zinc-800">
              No contact form messages received yet.
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/50 sm:flex-row sm:items-start"
              >
                <div className="space-y-1 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm">{m.subject}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        m.status === 'unread'
                          ? 'bg-[var(--kv-accent,#e50914)]/15 text-[var(--kv-accent,#e50914)]'
                          : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      {m.status}
                    </span>
                    <span className="text-zinc-500">· {formatRelativeTime(m.createdAt)}</span>
                  </div>
                  <p className="text-zinc-500">
                    From <span className="font-semibold text-zinc-800 dark:text-zinc-200">{m.name}</span> ({m.email}) via <span className="font-mono">/{m.pageSlug}</span>
                  </p>
                  <p className="pt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {m.message}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {m.status !== 'read' && (
                    <button
                      type="button"
                      onClick={() => onUpdateMessageStatus(m.id, 'read')}
                      className="rounded-lg border border-zinc-300 p-1.5 text-emerald-500 hover:bg-emerald-500/10 dark:border-zinc-700"
                      title="Mark read"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {m.status !== 'archived' && (
                    <button
                      type="button"
                      onClick={() => onUpdateMessageStatus(m.id, 'archived')}
                      className="rounded-lg border border-zinc-300 p-1.5 text-zinc-500 hover:bg-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      title="Archive"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteMessage(m.id)}
                    className="rounded-lg border border-zinc-300 p-1.5 text-rose-500 hover:bg-rose-500/10 dark:border-zinc-700"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
