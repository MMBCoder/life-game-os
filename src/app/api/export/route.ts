import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { exportUserData } from '@/services/export';
import { logFailure } from '@/lib/errors';

/**
 * Full data export as a JSON download. A route handler rather than a Server Action
 * because the response is a file, not a page update.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  try {
    const data = await exportUserData(user.id);
    const filename = `life-game-os-export-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logFailure('export', error, { userId: user.id });
    return NextResponse.json(
      { error: 'Export failed. Your data is unchanged. Please try again.' },
      { status: 500 },
    );
  }
}
