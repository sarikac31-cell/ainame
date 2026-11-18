import React, { useState } from 'react';
import { Check, Crown, Film, Lock, ShieldCheck } from 'lucide-react';
import type { MovieItem, SubscriptionPlan, UserProfile } from '../../types/streaming';
import { formatMonthlyPrice } from '../../utils/catalog';

interface SubscriptionsViewProps {
  plans: SubscriptionPlan[];
  movies: MovieItem[];
  user: UserProfile | null;
  highlightedPlanId?: string;
  onSubscribe: (plan: SubscriptionPlan) => Promise<void>;
  onCancelSubscription: () => Promise<void>;
  onOpenAuth: () => void;
  onSelectMovie: (movie: MovieItem) => void;
}

export function SubscriptionsView({
  plans,
  movies,
  user,
  highlightedPlanId,
  onSubscribe,
  onCancelSubscription,
  onOpenAuth,
  onSelectMovie,
}: SubscriptionsViewProps) {
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);

  const activePlans = plans.filter((p) => p.isActive).sort((a, b) => a.order - b.order);
  const currentPlanId = user?.plan === 'premium' ? user.subscriptionPlanId : null;
  const isExpired = Boolean(
    user?.planExpiresAt &&
      !Number.isNaN(Date.parse(user.planExpiresAt)) &&
      Date.parse(user.planExpiresAt) < Date.now()
  );

  const handleChoosePlan = async (plan: SubscriptionPlan) => {
    if (!user) {
      onOpenAuth();
      return;
    }
    setBusyPlanId(plan.id);
    try {
      await onSubscribe(plan);
    } finally {
      setBusyPlanId(null);
    }
  };

  const handleCancel = async () => {
    setCanceling(true);
    try {
      await onCancelSubscription();
    } finally {
      setCanceling(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-zinc-200 pb-8 dark:border-zinc-800">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-500">
            <Crown className="h-4 w-4" />
            <span>Monthly Membership Plans</span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-zinc-950 dark:text-white sm:text-4xl">
            Unlock Exclusive Titles by Plan
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Select a monthly subscription tier to watch films and series assigned to that plan.
            Free catalog titles remain open to everyone.
          </p>
        </div>

        {user && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs dark:border-zinc-800 dark:bg-[#13131c]">
            <ShieldCheck
              className={`h-4 w-4 ${
                user.plan === 'premium' && !isExpired ? 'text-emerald-500' : 'text-zinc-400'
              }`}
            />
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                {user.plan === 'premium' && user.subscriptionPlanName
                  ? isExpired
                    ? `${user.subscriptionPlanName} (Expired)`
                    : `Active: ${user.subscriptionPlanName}`
                  : user.plan === 'premium'
                  ? 'Active: Premium Membership'
                  : 'Current Tier: Free'}
              </p>
              {user.planExpiresAt && (
                <p className="font-mono-tabular text-[11px] text-zinc-500 dark:text-zinc-400">
                  {isExpired ? 'Expired' : 'Renews'} {user.planExpiresAt.slice(0, 10)}
                </p>
              )}
            </div>
            {user.plan === 'premium' && (
              <button
                type="button"
                disabled={canceling}
                onClick={handleCancel}
                className="ml-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 whitespace-nowrap"
              >
                {canceling ? 'Canceling...' : 'Cancel Plan'}
              </button>
            )}
          </div>
        )}
      </div>

      {activePlans.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-[#13131c]">
          <Crown className="mx-auto h-10 w-10 text-zinc-400" />
          <h2 className="mt-3 font-display text-lg font-semibold">No monthly plans published yet</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Administrators can create custom monthly subscription plans inside the Admin Console under Subscriptions.
          </p>
        </div>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {activePlans.map((plan) => {
            const isCurrent = currentPlanId === plan.id && !isExpired;
            const isHighlighted = highlightedPlanId === plan.id;
            const assignedMovies = movies.filter((m) => m.requiredPlanId === plan.id);
            const busy = busyPlanId === plan.id;

            return (
              <article
                key={plan.id}
                className={`flex flex-col justify-between rounded-2xl border bg-white p-6 transition-colors dark:bg-[#13131c] ${
                  isHighlighted || isCurrent
                    ? 'border-[var(--kv-accent,#e50914)] shadow-lg'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                        style={{ backgroundColor: plan.badgeColor || '#e50914' }}
                      >
                        <Crown className="h-4 w-4" />
                      </span>
                      <div>
                        <h2 className="font-display text-lg font-bold text-zinc-950 dark:text-white">
                          {plan.name}
                        </h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Billed monthly
                        </p>
                      </div>
                    </div>
                    {isCurrent && (
                      <span className="text-xs font-semibold text-emerald-500 whitespace-nowrap">
                        Active
                      </span>
                    )}
                  </div>

                  <div className="mt-5 flex items-baseline gap-1.5 border-b border-zinc-200 pb-5 dark:border-zinc-800">
                    <span className="font-display text-3xl font-bold tracking-tight text-zinc-950 dark:text-white tabular-nums">
                      {formatMonthlyPrice(plan.pricePerMonth, plan.currency).replace('/mo', '')}
                    </span>
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      / month
                    </span>
                  </div>

                  {plan.description && (
                    <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                      {plan.description}
                    </p>
                  )}

                  {plan.features.length > 0 && (
                    <ul className="mt-4 space-y-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Titles unlocked by this plan */}
                  <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      <Film className="h-3.5 w-3.5" />
                      <span>Included Titles ({assignedMovies.length})</span>
                    </p>
                    {assignedMovies.length === 0 ? (
                      <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                        No videos assigned to this tier yet.
                      </p>
                    ) : (
                      <div className="mt-2.5 space-y-1.5">
                        {assignedMovies.slice(0, 4).map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => onSelectMovie(m)}
                            className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/70"
                          >
                            <img
                              src={m.posterUrl}
                              alt={m.title}
                              referrerPolicy="no-referrer"
                              className="h-9 w-6 shrink-0 rounded object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                {m.title}
                              </p>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 capitalize tabular-nums">
                                {m.type} · {m.releaseYear}
                              </p>
                            </div>
                          </button>
                        ))}
                        {assignedMovies.length > 4 && (
                          <p className="px-1.5 text-[11px] text-zinc-500">
                            +{assignedMovies.length - 4} more titles
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-2">
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap"
                    >
                      <Check className="h-4 w-4" />
                      Active Monthly Plan
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleChoosePlan(plan)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--kv-accent,#e50914)] px-4 py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                    >
                      {!user && <Lock className="h-3.5 w-3.5" />}
                      {busy
                        ? 'Activating...'
                        : !user
                        ? `Sign In & Subscribe (${formatMonthlyPrice(plan.pricePerMonth, plan.currency)})`
                        : user.plan === 'premium'
                        ? `Switch to ${plan.name} (${formatMonthlyPrice(plan.pricePerMonth, plan.currency)})`
                        : `Subscribe Monthly (${formatMonthlyPrice(plan.pricePerMonth, plan.currency)})`}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
