'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';

export async function mergeCustomers(keepId: string, dropId: string): Promise<void> {
  const supabase = await requireAdmin();
  const { error } = await supabase.rpc('merge_customers', { p_keep_id: keepId, p_drop_id: dropId });
  if (error) throw new Error(`Unione non riuscita: ${error.message}`);
  revalidatePath('/admin/clienti', 'layout');
}
