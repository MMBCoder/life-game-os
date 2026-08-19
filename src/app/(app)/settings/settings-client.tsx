'use client';

import { useState, useTransition } from 'react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { ErrorState } from '@/components/ui/feedback';
import { deleteAccountAction, updateTimezoneAction } from './actions';

export function TimezoneSetting({ current }: { current: string }) {
  const [timezone, setTimezone] = useState(current);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const detected = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return null;
    }
  })();

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Timezone</CardTitle>
          <p className="type-small mt-1 text-ink-muted">
            Your day boundaries, daily plan and 30/60/90 timeline are all resolved in this zone.
          </p>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        {error && <ErrorState message={error} />}
        <Input
          label="IANA timezone"
          value={timezone}
          onChange={(e) => {
            setTimezone(e.target.value);
            setSaved(false);
          }}
          hint={
            detected && detected !== timezone
              ? `Your browser reports ${detected}.`
              : 'For example, Europe/London or America/New_York.'
          }
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            loading={pending}
            disabled={timezone === current}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await updateTimezoneAction(timezone);
                if (!result.ok) setError(result.error);
                else setSaved(true);
              })
            }
          >
            Save
          </Button>
          {detected && detected !== timezone && (
            <Button size="sm" variant="ghost" onClick={() => setTimezone(detected)}>
              Use {detected}
            </Button>
          )}
          {saved && <span className="type-small text-protect">Saved.</span>}
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * Deletion is real and irreversible, so the affordance is deliberately slow:
 * expand, then type an exact phrase. The phrase is re-checked server-side.
 */
export function DangerZone() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card tone="risk">
      <CardHeader>
        <div>
          <CardTitle>Delete everything</CardTitle>
          <p className="type-small mt-1 text-ink-muted">
            Removes your account and every row associated with it — model, life map, goals, games,
            reflections, memory and council history. This cannot be undone.
          </p>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {error && <ErrorState message={error} />}

        {!open ? (
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            I want to delete my account
          </Button>
        ) : (
          <>
            <p className="type-small text-ink">
              Consider{' '}
              <a href="/api/export" className="text-primary underline underline-offset-4">
                exporting your data
              </a>{' '}
              first. Once this is done, none of it is recoverable.
            </p>
            <Input
              label="Type “delete everything” to confirm"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="danger"
                loading={pending}
                disabled={confirmation.trim().toLowerCase() !== 'delete everything'}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const result = await deleteAccountAction(confirmation);
                    if (result && !result.ok) setError(result.error);
                  })
                }
              >
                Delete my account permanently
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
