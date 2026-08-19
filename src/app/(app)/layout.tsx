import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getSessionUser } from '@/lib/auth/session';
import { getProfile } from '@/lib/db/repositories/users';
import { AppNav } from '@/components/nav/app-nav';
import { signOutAction } from '@/app/(auth)/actions';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');

  const profile = await getProfile(user.id);
  const onboarded = profile?.onboardingStage === 'complete';

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <AppNav
        userName={user.name}
        onboarded={onboarded}
        isDemo={user.isDemo}
        signOut={signOutAction}
      />
      <div className="min-w-0">
        <main id="main" className="mx-auto max-w-5xl px-5 pt-6 pb-28 md:px-8 md:pt-10 lg:pb-16">
          {children}
        </main>
      </div>
    </div>
  );
}
