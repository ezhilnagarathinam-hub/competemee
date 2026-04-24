import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type TableName = 'questions' | 'students' | 'competitions' | 'student_competitions' | 'student_answers' | 'support_tickets';

interface SoftDeleteOptions {
  table: TableName;
  ids: string[];
  /** Label shown in the toast, e.g. "Question", "Player", "Competition" */
  label: string;
  /** Called after successful delete and after successful undo */
  onChange?: () => void;
  /** Seconds before the undo window closes (default 8) */
  durationMs?: number;
  /** Optional related rows to also restore on undo (snapshot taken before delete) */
  related?: Array<{
    table: TableName;
    /** Filter used to fetch & re-delete related rows */
    filter: (q: any) => any;
  }>;
}

/**
 * Deletes rows but keeps a snapshot in memory and shows an "Undo" toast.
 * Clicking Undo re-inserts the original rows (including related rows if provided).
 */
export async function softDelete({
  table,
  ids,
  label,
  onChange,
  durationMs = 8000,
  related = [],
}: SoftDeleteOptions): Promise<boolean> {
  if (ids.length === 0) return false;

  try {
    // 1. Snapshot the main rows
    const { data: mainSnapshot, error: snapErr } = await supabase
      .from(table)
      .select('*')
      .in('id', ids);
    if (snapErr) throw snapErr;

    // 2. Snapshot related rows (e.g. student_competitions when deleting a student)
    const relatedSnapshots: Array<{ table: TableName; rows: any[] }> = [];
    for (const rel of related) {
      const query = rel.filter(supabase.from(rel.table).select('*'));
      const { data: relData, error: relErr } = await query;
      if (relErr) throw relErr;
      relatedSnapshots.push({ table: rel.table, rows: relData || [] });
    }

    // 3. Delete main rows (related rows usually cascade or are deleted first by caller)
    const { error: delErr } = await supabase.from(table).delete().in('id', ids);
    if (delErr) throw delErr;

    onChange?.();

    const count = ids.length;
    const message = count > 1 ? `${count} ${label}s deleted` : `${label} deleted`;

    toast.success(message, {
      duration: durationMs,
      action: {
        label: 'Undo',
        onClick: async () => {
          try {
            // Restore main rows
            if (mainSnapshot && mainSnapshot.length > 0) {
              const { error: restoreErr } = await supabase
                .from(table)
                .insert(mainSnapshot as any);
              if (restoreErr) throw restoreErr;
            }
            // Restore related rows
            for (const snap of relatedSnapshots) {
              if (snap.rows.length > 0) {
                const { error: relRestoreErr } = await supabase
                  .from(snap.table)
                  .insert(snap.rows as any);
                if (relRestoreErr) throw relRestoreErr;
              }
            }
            toast.success(`${label} restored`);
            onChange?.();
          } catch (err) {
            console.error('Undo failed:', err);
            toast.error(`Could not restore ${label.toLowerCase()}`);
          }
        },
      },
    });

    return true;
  } catch (error) {
    console.error(`Error deleting ${label.toLowerCase()}:`, error);
    toast.error(`Failed to delete ${label.toLowerCase()}`);
    return false;
  }
}
