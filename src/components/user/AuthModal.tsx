import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Modal } from '../ui/Modal';

interface AuthModalProps {
  open: boolean;
  allowRegistration: boolean;
  allowSocialLogin?: boolean;
  onClose: () => void;
  onGoogleLogin: () => Promise<void>;
  onEmailLogin: (email: string, password: string) => Promise<void>;
  onEmailRegister: (email: string, password: string, displayName: string) => Promise<void>;
  onForgotPassword: (email: string) => Promise<void>;
}

export function AuthModal({
  open,
  allowRegistration,
  allowSocialLogin = true,
  onClose,
  onGoogleLogin,
  onEmailLogin,
  onEmailRegister,
  onForgotPassword,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [focusedField, setFocusedField] = useState<'none' | 'email' | 'password' | 'name'>('none');
  const [imgFailed, setImgFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await onEmailLogin(email.trim(), password);
        onClose();
      } else if (mode === 'register') {
        await onEmailRegister(email.trim(), password, displayName.trim());
        setNotice('Account created. Check your inbox to verify your email address.');
        onClose();
      } else {
        await onForgotPassword(email.trim());
        setNotice('Password reset email sent.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setBusy(true);
    try {
      await onGoogleLogin();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const companionCaption =
    focusedField === 'password'
      ? 'Looking away while you enter your password.'
      : focusedField === 'email'
      ? 'Enter your Gmail or email to sync your watchlist.'
      : mode === 'register'
      ? 'Ready to unlock your personal screening room?'
      : mode === 'reset'
      ? 'We will send a recovery link to your inbox.'
      : 'Welcome back. Pick up right where you left off.';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        mode === 'login'
          ? 'Sign In to KinoVault'
          : mode === 'register'
          ? 'Create Account'
          : 'Reset Password'
      }
      maxWidthClass="max-w-3xl"
    >
      <div className="grid items-stretch gap-6 md:grid-cols-[270px_1fr]">
        {/* Side Companion Panel: Anime Catgirl standing beside Gmail & Password */}
        <div className="relative flex min-h-[220px] flex-col justify-end overflow-hidden rounded-xl border border-zinc-800 bg-[#0b0b0f] md:min-h-[430px]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(229,9,20,0.22),transparent_68%)]"
          />
          {!imgFailed ? (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0"
            >
              <img
                src="/src/assets/images/anime_catgirl_signin_1794831916571.jpg"
                alt="Anime catgirl companion standing beside sign-in form"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="h-full w-full object-cover object-top"
              />
            </motion.div>
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-b from-zinc-900 to-[#0b0b0f] p-6 text-center text-xs text-zinc-400">
              KinoVault Companion
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0b0b0f] via-[#0b0b0f]/80 to-transparent" />
          <div className="relative z-10 p-4 text-white">
            <p className="text-xs font-semibold text-rose-300">KinoVault Concierge</p>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-200">{companionCaption}</p>
          </div>
        </div>

        {/* Right Column: Google + Gmail & Password Fields */}
        <div className="flex flex-col justify-center space-y-4">
          {allowSocialLogin && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={handleGoogle}
                className="flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
              >
                <span>Continue with Google</span>
              </button>

              <div className="flex items-center gap-3 text-xs text-zinc-400">
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                <span>or sign in with Gmail / email</span>
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-name" className="mb-1 block text-xs text-zinc-500">
                  Full Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  value={displayName}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField('none')}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex Vance"
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--kv-accent,#e50914)] dark:border-zinc-700"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="mb-1 block text-xs text-zinc-500">
                Gmail / Email Address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField('none')}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gmail.com"
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--kv-accent,#e50914)] dark:border-zinc-700"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <label htmlFor="auth-pw" className="mb-1 block text-xs text-zinc-500">
                  Password
                </label>
                <input
                  id="auth-pw"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField('none')}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--kv-accent,#e50914)] dark:border-zinc-700"
                />
              </div>
            )}

            {error && <p className="text-xs text-rose-500">{error}</p>}
            {notice && <p className="text-xs text-emerald-500">{notice}</p>}

            <button
              type="submit"
              disabled={busy}
              className="min-h-[44px] w-full rounded-lg bg-[var(--kv-accent,#e50914)] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy
                ? 'Working...'
                : mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                ? 'Create Account'
                : 'Send Reset Link'}
            </button>
          </form>

          <div className="flex items-center justify-between text-xs text-zinc-500">
            {mode !== 'reset' ? (
              <button type="button" onClick={() => setMode('reset')} className="hover:underline">
                Forgot password?
              </button>
            ) : (
              <button type="button" onClick={() => setMode('login')} className="hover:underline">
                Back to Sign In
              </button>
            )}

            {mode === 'login' && allowRegistration && (
              <button type="button" onClick={() => setMode('register')} className="hover:underline">
                Create account
              </button>
            )}
            {mode === 'register' && (
              <button type="button" onClick={() => setMode('login')} className="hover:underline">
                Already have an account?
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
