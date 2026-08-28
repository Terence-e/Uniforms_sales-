'use client';

import { LifeBuoyIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/** Support affordance from the auth screens. Feedback is shown in-app (toast). */
export function SupportButton() {
  const t = useTranslations('Auth');
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2 rounded-full"
      onClick={() => toast.info(t('supportToast'))}
    >
      <LifeBuoyIcon className="size-4" />
      {t('support')}
    </Button>
  );
}
