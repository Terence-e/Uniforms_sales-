'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellIcon, InboxIcon, Trash2Icon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearNotifications,
  type AppNotification
} from '@/actions/notifications';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const t = useTranslations('Notifications');
  const locale = useLocale();
  const router = useRouter();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const refresh = useCallback(async () => setItems(await listNotifications()), []);
  useEffect(() => {
    // Fetch on mount inside the promise callback (not synchronously in the
    // effect body), and ignore the result if we unmounted first.
    let active = true;
    listNotifications().then((data) => {
      if (active) setItems(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const unread = items.filter((i) => !i.is_read).length;

  const text = (n: AppNotification) => {
    if (n.type === 'password_reset_request') {
      return {
        title: t('passwordResetRequest.title'),
        body: t('passwordResetRequest.body', { email: String(n.data.email ?? '') })
      };
    }
    return { title: t('generic'), body: '' };
  };

  async function openItem(n: AppNotification) {
    setOpen(false);
    setShowAll(false);
    if (!n.is_read) {
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, is_read: true } : i)));
      await markNotificationRead(n.id);
    }
    if (n.link) router.push(n.link);
  }

  async function onDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await deleteNotification(id);
  }

  async function onClearAll() {
    setItems([]);
    await clearNotifications();
  }

  async function onMarkAllRead() {
    setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
    await markAllNotificationsRead();
  }

  return (
    <>
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('title')}
          onClick={() => {
            const next = !open;
            setOpen(next);
            if (next) refresh();
          }}
        >
          <BellIcon className="size-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg">
              <div className="flex items-center justify-between border-b px-4 py-2.5">
                <p className="text-sm font-semibold">{t('title')}</p>
                {unread > 0 && (
                  <button
                    suppressHydrationWarning
                    onClick={onMarkAllRead}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {t('markAllRead')}
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
                    <InboxIcon className="size-6" />
                    {t('empty')}
                  </div>
                ) : (
                  items.slice(0, 6).map((n) => {
                    const { title, body } = text(n);
                    return (
                      <button
                        suppressHydrationWarning
                        key={n.id}
                        onClick={() => openItem(n)}
                        className={cn(
                          'flex w-full flex-col items-start gap-0.5 border-b px-4 py-3 text-left last:border-0 hover:bg-muted/60',
                          !n.is_read && 'bg-primary/5'
                        )}
                      >
                        <span className="flex w-full items-center gap-2 text-sm font-medium">
                          {!n.is_read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                          {title}
                        </span>
                        {body && <span className="line-clamp-2 text-xs text-muted-foreground">{body}</span>}
                        <span className="text-[11px] text-muted-foreground/70">
                          {formatDateTime(n.created_at, locale)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setOpen(false);
                    setShowAll(true);
                    refresh();
                  }}
                >
                  {t('seeAll')}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('allTitle')}</DialogTitle>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                <InboxIcon className="size-7" />
                {t('empty')}
              </div>
            ) : (
              items.map((n) => {
                const { title, body } = text(n);
                return (
                  <div
                    key={n.id}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-3',
                      !n.is_read && 'bg-primary/5'
                    )}
                  >
                    <button onClick={() => openItem(n)} className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-medium">{title}</p>
                      {body && <p className="text-xs text-muted-foreground">{body}</p>}
                      <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                        {formatDateTime(n.created_at, locale)}
                      </p>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('delete')}
                      onClick={() => onDelete(n.id)}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="sm:justify-between">
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={onClearAll}
              disabled={items.length === 0}
            >
              {t('clearAll')}
            </Button>
            <Button onClick={() => setShowAll(false)}>{t('close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
