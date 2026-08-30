'use server';

import { createClient } from '@/lib/supabase/server';
import {
  alterationStage,
  orderStage,
  sortOldestFirst,
  type OpenJob
} from '@/lib/open-jobs';

/**
 * Everything not yet closed, from both sources, as one list (A-FR-9.16).
 *
 * Two queries rather than one: orders and alterations are separate tables with
 * separate shapes, and PostgREST has no UNION. They are merged and sorted here,
 * which is fine at a school uniform shop's volume -- the open pile is the work
 * of a few weeks, not a warehouse. If it ever isn't, this becomes a view.
 *
 * RLS scopes both halves the same way it scopes everything else: a seller sees
 * their own, oversight roles see all. Nothing extra is checked here.
 */
export async function listOpenJobs(): Promise<OpenJob[]> {
  const supabase = await createClient();

  const [orderLines, alterations] = await Promise.all([
    // Only lines still to be dealt with. A line handed over at the counter has
    // status null and was never a job; collected and cancelled are closed.
    supabase
      .from('order_items')
      .select(
        `id, description, size, status,
         order:orders!order_items_order_id_fkey (
           id, order_no, ordered_at, expected_ready_date,
           customer_name, student_name, class_level
         )`
      )
      .in('status', ['ordered', 'in_production', 'ready']),

    supabase
      .from('alterations')
      .select(
        `id, alteration_no, received_at, expected_ready_date, status,
         customer_name, student_name, class_level, garment, size`
      )
      .in('status', ['received', 'in_progress', 'ready'])
  ]);

  const jobs: OpenJob[] = [];

  for (const line of orderLines.data ?? []) {
    const order = line.order;
    // An order line with no parent order cannot be shown or linked to; skipping
    // beats rendering a card that goes nowhere.
    if (!order || !line.status) continue;
    const stage = orderStage(line.status);
    if (!stage) continue;

    jobs.push({
      key: `order:${line.id}`,
      kind: 'order',
      href: `/orders/${order.id}`,
      reference: order.order_no,
      stage,
      statusLabel: line.status,
      studentName: order.student_name,
      classLevel: order.class_level,
      customerName: order.customer_name,
      garment: line.description,
      size: line.size,
      openedAt: order.ordered_at,
      expectedReadyDate: order.expected_ready_date
    });
  }

  for (const alteration of alterations.data ?? []) {
    const stage = alterationStage(alteration.status);
    if (!stage) continue;

    jobs.push({
      key: `alteration:${alteration.id}`,
      kind: 'alteration',
      href: `/alterations/${alteration.id}`,
      reference: alteration.alteration_no,
      stage,
      statusLabel: alteration.status,
      studentName: alteration.student_name,
      classLevel: alteration.class_level,
      customerName: alteration.customer_name,
      garment: alteration.garment,
      size: alteration.size,
      openedAt: alteration.received_at,
      expectedReadyDate: alteration.expected_ready_date
    });
  }

  return sortOldestFirst(jobs);
}
