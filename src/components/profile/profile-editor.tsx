'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CameraIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { updateOwnProfile } from '@/actions/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { fileToSquareDataUrl } from '@/lib/image';
import { cn } from '@/lib/utils';

function initialsOf(name: string, email: string) {
  const src = name.trim() || email;
  const parts = src.trim().split(/\s+/).filter(Boolean);
  return (parts.map((p) => p[0]).slice(0, 2).join('') || 'U').toUpperCase();
}

function Avatar({
  url,
  fallback,
  className
}: {
  url: string | null;
  fallback: string;
  className?: string;
}) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- data URL avatar
    <img src={url} alt="" className={cn('rounded-full object-cover', className)} />
  ) : (
    <span
      className={cn(
        'flex items-center justify-center rounded-full bg-primary/10 font-semibold text-primary',
        className
      )}
    >
      {fallback}
    </span>
  );
}

export function ProfileEditor({
  fullName,
  email,
  roleLabel,
  avatarUrl,
  isActive
}: {
  fullName: string;
  email: string;
  roleLabel: string;
  avatarUrl: string | null;
  isActive: boolean;
}) {
  const t = useTranslations('Profile');
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(fullName);
  const [avatar, setAvatar] = useState<string | null>(avatarUrl);
  const [pending, setPending] = useState(false);

  const fallback = initialsOf(fullName, email);

  function reset() {
    setName(fullName);
    setAvatar(avatarUrl);
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('notAnImage'));
      return;
    }
    try {
      setAvatar(await fileToSquareDataUrl(file));
    } catch {
      toast.error(t('updateError'));
    }
  }

  async function onSave() {
    if (!name.trim()) {
      toast.error(t('nameRequired'));
      return;
    }
    setPending(true);
    const res = await updateOwnProfile({ full_name: name, avatar_url: avatar });
    setPending(false);
    if (res.ok) {
      toast.success(t('updated'));
      setOpen(false);
      router.refresh();
    } else {
      const key = ['nameRequired', 'imageTooLarge'].includes(res.error)
        ? res.error
        : 'updateError';
      toast.error(t(key));
    }
  }

  const rows = [
    { label: t('fullName'), value: fullName || t('notSet') },
    { label: t('email'), value: email || t('notSet') },
    { label: t('role'), value: roleLabel }
  ];

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative rounded-full outline-none ring-offset-2 ring-offset-card focus-visible:ring-2 focus-visible:ring-ring"
          title={t('editPhoto')}
        >
          <Avatar url={avatarUrl} fallback={fallback} className="size-20 text-2xl" />
          <span className="absolute bottom-0 right-0 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow ring-2 ring-card transition group-hover:scale-105">
            <CameraIcon className="size-3.5" />
          </span>
        </button>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h2 className="truncate text-lg font-semibold">{fullName || email}</h2>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <Badge variant="secondary">{roleLabel}</Badge>
            <Badge variant={isActive ? 'secondary' : 'destructive'}>
              {isActive ? t('active') : t('inactive')}
            </Badge>
          </div>
        </div>

        <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
          <PencilIcon className="size-4" />
          {t('edit')}
        </Button>
      </div>

      <dl className="mt-6 divide-y border-t">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 py-3">
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="truncate text-sm font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editTitle')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar url={avatar} fallback={fallback} className="size-16 text-xl" />
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickFile}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => fileRef.current?.click()}
                >
                  <CameraIcon className="size-4" />
                  {t('changePhoto')}
                </Button>
                {avatar && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-muted-foreground"
                    onClick={() => setAvatar(null)}
                  >
                    <Trash2Icon className="size-4" />
                    {t('removePhoto')}
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="full_name">{t('fullName')}</Label>
              <Input
                id="full_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">{t('email')}</p>
                <p className="truncate font-medium">{email}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('role')}</p>
                <p className="font-medium">{roleLabel}</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={pending}
            >
              {t('cancel')}
            </Button>
            <Button type="button" className="gap-2" onClick={onSave} disabled={pending}>
              {pending && (
                <Spinner className="size-4 border-primary-foreground/40 border-t-primary-foreground" />
              )}
              {pending ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
