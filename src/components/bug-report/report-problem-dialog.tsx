'use client';

import { useRef, useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Bug, ImagePlus, X } from 'lucide-react';
import { submitBugReport } from '@/actions/bug-reports';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * "Report a problem" (A-13).
 *
 * The user writes what went wrong. Everything else -- which page they were on,
 * what browser they are using -- is captured for them, because they will not
 * think to include it and should not have to. "The total came out wrong" plus
 * the URL and the browser is a report someone can act on.
 *
 * The screenshot is optional and compressed here rather than uploaded raw: it
 * is stored as a data URL in a text column, the same way avatars are, so a
 * 4 MB phone photo has to become something a column can hold.
 */

/** Comfortably under the column's ~1.5 MB cap once base64-encoded. */
const MAX_EDGE = 1400;
const JPEG_QUALITY = 0.7;

export function ReportProblemDialog() {
  const t = useTranslations('BugReport');
  const tv = useTranslations('Validation');
  const pathname = usePathname();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Draws the picture onto a canvas at a bounded size and re-encodes it as
   * JPEG. Without this a modern phone camera produces several megabytes, which
   * the column would reject and the user would read as "it didn't work".
   */
  async function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      setScreenshot(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    } catch {
      toast.error(t('screenshotFailed'));
    }
  }

  function submit() {
    if (description.trim().length < 10) {
      setError(tv('describeMore'));
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await submitBugReport({
        description,
        // The path without the locale prefix is what a maintainer needs to find
        // the screen; which language it was in is in the user agent's company.
        pageUrl: pathname,
        userAgent: typeof navigator === 'undefined' ? null : navigator.userAgent,
        screenshot
      });

      if (!result.ok) {
        toast.error(
          result.error === 'validation' ? tv('describeMore') : result.error
        );
        return;
      }

      toast.success(t('thanks'));
      setDescription('');
      setScreenshot(null);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {/* Discreet on purpose: present on every screen, competing with none of
            them. */}
        <button
          type="button"
          suppressHydrationWarning
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          <Bug className="size-3.5" />
          {t('reportProblem')}
        </button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bug-description">{t('whatHappened')}</Label>
            <Textarea
              id="bug-description"
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('whatHappenedHint')}
              aria-invalid={Boolean(error)}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <div className="space-y-2">
            <Label>{t('screenshot')}</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickFile}
              suppressHydrationWarning
            />
            {screenshot ? (
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL, not an optimisable asset */}
                <img
                  src={screenshot}
                  alt={t('screenshot')}
                  className="h-20 rounded border object-contain"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setScreenshot(null)}
                >
                  <X className="size-4" />
                  {t('removeScreenshot')}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="size-4" />
                {t('addScreenshot')}
              </Button>
            )}
          </div>

          {/* Said plainly, so nobody is surprised later by what was sent. */}
          <p className="text-xs text-muted-foreground">
            {t('autoCaptured', { page: pathname })}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? t('sending') : t('send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
