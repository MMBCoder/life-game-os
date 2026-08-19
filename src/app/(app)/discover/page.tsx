import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth/session';
import { getProfile } from '@/lib/db/repositories/users';
import { DiscoverFlow } from './discover-flow';

export const metadata: Metadata = { title: 'Discovery' };

export default async function DiscoverPage() {
  const user = await requireSession();
  const profile = await getProfile(user.id);

  // Re-running discovery would overwrite a Personal Model the person has already
  // corrected, so completed accounts are sent on.
  if (profile?.onboardingStage === 'complete') redirect('/dashboard');

  return <DiscoverFlow name={user.name} />;
}
