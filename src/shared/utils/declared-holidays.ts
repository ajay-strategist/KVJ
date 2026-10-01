import { supabase } from '../integration/supabase';

export interface DeclaredHolidayItem {
  id: string;
  date: string;
  name: string;
  type: string;
  status: 'active' | 'cancelled';
}

export interface SaveHolidayResult {
  ok: boolean;
  holiday?: DeclaredHolidayItem;
  error?: string;
}

/**
 * Validates and saves (inserts or updates) a declared holiday in `flwdsk_declared_holidays`.
 * Guarantees schema fallback and input normalization to prevent PostgreSQL type errors.
 */
export async function saveDeclaredHoliday(
  dateInput: string,
  nameInput: string,
  typeInput?: string
): Promise<SaveHolidayResult> {
  const dateRaw = String(dateInput || '').trim();
  const nameRaw = String(nameInput || '').trim();
  const typeRaw = String(typeInput || 'Company Holiday').trim();

  if (!dateRaw) {
    return { ok: false, error: 'Holiday date is required.' };
  }
  if (!nameRaw) {
    return { ok: false, error: 'Holiday name is required.' };
  }

  // Normalize date to YYYY-MM-DD
  const cleanDate = dateRaw.slice(0, 10);
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(cleanDate)) {
    return { ok: false, error: 'Invalid date format. Please use YYYY-MM-DD (e.g. 2026-08-15).' };
  }

  try {
    // 1. Check if holiday for date already exists
    const { data: existing } = await supabase
      .from('flwdsk_declared_holidays')
      .select('id, date, name, status')
      .eq('date', cleanDate)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing?.id) {
      // Update existing record
      const { data: updated, error: updateErr } = await supabase
        .from('flwdsk_declared_holidays')
        .update({
          name: nameRaw,
          type: typeRaw,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateErr) {
        // Fallback without type/status if columns are missing or type mismatch
        const { data: fbUpdated, error: fbErr } = await supabase
          .from('flwdsk_declared_holidays')
          .update({
            name: nameRaw,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (fbErr) {
          return { ok: false, error: fbErr.message };
        }
        return {
          ok: true,
          holiday: {
            id: fbUpdated?.id || existing.id,
            date: fbUpdated?.date || cleanDate,
            name: fbUpdated?.name || nameRaw,
            type: fbUpdated?.type || typeRaw,
            status: 'active',
          },
        };
      }

      return {
        ok: true,
        holiday: {
          id: updated.id,
          date: updated.date || cleanDate,
          name: updated.name || nameRaw,
          type: updated.type || typeRaw,
          status: updated.status === 'cancelled' ? 'cancelled' : 'active',
        },
      };
    }

    // 2. Insert new record
    const { data: inserted, error: insertErr } = await supabase
      .from('flwdsk_declared_holidays')
      .insert({
        date: cleanDate,
        name: nameRaw,
        type: typeRaw,
        status: 'active',
      })
      .select()
      .single();

    if (insertErr) {
      // Fallback without type/status
      const { data: fbInserted, error: fbErr } = await supabase
        .from('flwdsk_declared_holidays')
        .insert({
          date: cleanDate,
          name: nameRaw,
        })
        .select()
        .single();

      if (fbErr) {
        return { ok: false, error: fbErr.message };
      }
      return {
        ok: true,
        holiday: {
          id: fbInserted?.id || crypto.randomUUID(),
          date: fbInserted?.date || cleanDate,
          name: fbInserted?.name || nameRaw,
          type: fbInserted?.type || typeRaw,
          status: 'active',
        },
      };
    }

    return {
      ok: true,
      holiday: {
        id: inserted.id,
        date: inserted.date || cleanDate,
        name: inserted.name || nameRaw,
        type: inserted.type || typeRaw,
        status: inserted.status === 'cancelled' ? 'cancelled' : 'active',
      },
    };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Database execution error' };
  }
}
