import { getTranslations } from 'next-intl/server';
import { EyeOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Stands in for a write form on a screen Administration can otherwise fully
 * read (A-FR-2.2). The role's write path was already refused at the database
 * before this existed -- can_operate() covers every insert, update and RPC --
 * so this changes nothing about what can happen. It only stops the interface
 * offering a form that would fill out and then fail: P-3 is explicit that
 * hiding a control is a courtesy, not a permission check, and the guard stays
 * exactly where it already was.
 */
export async function ReadOnlyNotice() {
  const t = await getTranslations('Common');
  return (
    <Card>
      <CardContent className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <EyeOff className="size-4 shrink-0" />
        {t('readOnlyNotice')}
      </CardContent>
    </Card>
  );
}
