'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { ThemeToggle } from './theme-toggle';

interface NavItem {
  href: string;
  label: string;
  /** Shown in the mobile bar; the rest are desktop-only. */
  primary?: boolean;
}

const PLAY: NavItem[] = [
  { href: '/dashboard', label: 'Today', primary: true },
  { href: '/reflection', label: 'Reflection', primary: true },
];

const PLAN: NavItem[] = [
  { href: '/goal', label: 'Whole Goal' },
  { href: '/player', label: 'Player', primary: true },
  { href: '/game', label: 'Game', primary: true },
  { href: '/protocol', label: 'Protocol' },
];

const UNDERSTAND: NavItem[] = [
  { href: '/life', label: 'Life Map' },
  { href: '/insight', label: 'Insight' },
  { href: '/council', label: 'Council', primary: true },
];

const ALL = [...PLAY, ...PLAN, ...UNDERSTAND];

export function AppNav({
  userName,
  onboarded,
  isDemo,
  signOut,
}: {
  userName: string;
  onboarded: boolean;
  isDemo: boolean;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <nav
        aria-label="Main"
        className="hidden border-r border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col"
      >
        <div className="px-5 pt-6 pb-5">
          <Link href="/dashboard" className="type-label text-ink">
            Life Game OS
          </Link>
          <p className="type-small mt-1 truncate text-ink-faint">{userName}</p>
          {isDemo && (
            <span className="type-label mt-2 inline-block rounded-full border border-line-strong px-2 py-0.5 text-ink-faint">
              Demo account
            </span>
          )}
        </div>

        <div className="grow space-y-6 overflow-y-auto px-3 pb-4">
          {!onboarded && (
            <Link
              href="/discover"
              className={cn(
                'block rounded-[var(--radius-md)] border border-primary/40 bg-primary-soft/50 px-3 py-2.5',
                pathname === '/discover' && 'border-primary',
              )}
            >
              <p className="type-small font-semibold text-ink">Finish discovery</p>
              <p className="type-small mt-0.5 text-ink-muted">Three questions to start.</p>
            </Link>
          )}

          <NavGroup label="Play" items={PLAY} pathname={pathname} />
          <NavGroup label="Plan" items={PLAN} pathname={pathname} />
          <NavGroup label="Understand" items={UNDERSTAND} pathname={pathname} />
        </div>

        <div className="space-y-1 border-t border-line px-3 py-3">
          <NavLink href="/settings" label="Settings" active={pathname === '/settings'} />
          <div className="flex items-center justify-between px-3 py-1">
            <ThemeToggle />
            <form action={signOut}>
              <button
                type="submit"
                className="type-small text-ink-faint transition-colors hover:text-ink"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-line bg-surface px-5 py-3 lg:hidden">
        <Link href="/dashboard" className="type-label text-ink">
          Life Game OS
        </Link>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <form action={signOut}>
            <button type="submit" className="type-small text-ink-faint">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Mobile bottom bar — the check-in surfaces, not the whole product */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface lg:hidden"
      >
        {ALL.filter((item) => item.primary).map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex-1 py-3 text-center text-xs transition-colors',
                active ? 'font-semibold text-primary' : 'text-ink-muted',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <div>
      <p className="type-label px-3 pb-1.5 text-ink-faint">{label}</p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.href}>
            <NavLink
              href={item.href}
              label={item.label}
              active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'block rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-primary-soft font-medium text-primary'
          : 'text-ink-muted hover:bg-bg-subtle hover:text-ink',
      )}
    >
      {label}
    </Link>
  );
}
