import React, { useState, useEffect } from 'react';
import Drawer from '../../../shared/ui/Drawer';
import { Button } from '../../../shared/ui/components';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { supabase } from '../../../shared/integration/supabase';

export interface TravelRate {
  id: string;
  name: string;
  ratePerKm: number;
  icon?: string;
}

export const DEFAULT_TRAVEL_RATES: TravelRate[] = [
  { id: 'bike', name: 'Bike', ratePerKm: 5.2, icon: '🏍️' },
  { id: 'car', name: 'Car', ratePerKm: 8.5, icon: '🚗' },
];

export interface TravelRatesModalProps {
  open: boolean;
  onClose: () => void;
  travelRates?: TravelRate[];
  bikeRate?: number;
  carRate?: number;
  onRatesUpdated: (rates: TravelRate[], bikeRate?: number, carRate?: number) => void;
}

const COMMON_ICONS = ['🏍️', '🚗', '🛺', '🚐', '🚕', '🚲', '🚌', '🚆'];

export function TravelRatesModal({
  open,
  onClose,
  travelRates,
  bikeRate: initialBikeRate,
  carRate: initialCarRate,
  onRatesUpdated,
}: TravelRatesModalProps) {
  const { toast } = useNotifications();
  const [rates, setRates] = useState<TravelRate[]>(() => {
    if (travelRates && travelRates.length > 0) return travelRates;
    return [
      { id: 'bike', name: 'Bike', ratePerKm: initialBikeRate ?? 5.2, icon: '🏍️' },
      { id: 'car', name: 'Car', ratePerKm: initialCarRate ?? 8.5, icon: '🚗' },
    ];
  });
  const [saving, setSaving] = useState<boolean>(false);

  // Synchronize state whenever modal opens or props update
  useEffect(() => {
    if (open) {
      if (travelRates && travelRates.length > 0) {
        setRates(travelRates.map((r) => ({ ...r })));
      } else {
        setRates([
          { id: 'bike', name: 'Bike', ratePerKm: initialBikeRate ?? 5.2, icon: '🏍️' },
          { id: 'car', name: 'Car', ratePerKm: initialCarRate ?? 8.5, icon: '🚗' },
        ]);
      }
    }
  }, [open, travelRates, initialBikeRate, initialCarRate]);

  const handleRateChange = (index: number, field: keyof TravelRate, value: any) => {
    setRates((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddRate = () => {
    const newId = `rate_${Date.now()}`;
    setRates((prev) => [
      ...prev,
      { id: newId, name: 'Auto / Other', ratePerKm: 10.0, icon: '🛺' },
    ]);
  };

  const handleDeleteRate = (index: number) => {
    if (rates.length <= 1) {
      toast({ variant: 'warning', title: 'Action Denied', message: 'At least one travel reimbursement rate is required.' });
      return;
    }
    setRates((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Validate
      for (const r of rates) {
        if (!r.name.trim()) {
          toast({ variant: 'error', title: 'Validation Error', message: 'All vehicle rate types must have a name.' });
          setSaving(false);
          return;
        }
        if (typeof r.ratePerKm !== 'number' || isNaN(r.ratePerKm) || r.ratePerKm <= 0) {
          toast({ variant: 'error', title: 'Validation Error', message: `Please enter a valid rate per KM for ${r.name}.` });
          setSaving(false);
          return;
        }
      }

      const bikeObj = rates.find((r) => r.id === 'bike' || r.name.toLowerCase().includes('bike'));
      const carObj = rates.find((r) => r.id === 'car' || r.name.toLowerCase().includes('car'));
      const bikeVal = bikeObj ? bikeObj.ratePerKm : rates[0]?.ratePerKm || 5.2;
      const carVal = carObj ? carObj.ratePerKm : rates[1]?.ratePerKm || rates[0]?.ratePerKm || 8.5;

      // 1. Save dynamic rates list to localStorage as immediate offline cache
      localStorage.setItem('kvj_travel_rates', JSON.stringify(rates));
      localStorage.setItem('kvj_bike_rate', String(bikeVal));
      localStorage.setItem('kvj_car_rate', String(carVal));

      // 2. Save to Supabase system settings
      try {
        const valStr = JSON.stringify(rates);
        const { error: errRates } = await supabase
          .from('flwdsk_system_settings')
          .upsert({ key: 'travel_rates', value: rates });

        if (errRates) {
          // Retry as string in case column is TEXT
          await supabase
            .from('flwdsk_system_settings')
            .upsert({ key: 'travel_rates', value: valStr });
        }

        // Keep legacy keys synced for backward compatibility
        await supabase
          .from('flwdsk_system_settings')
          .upsert({ key: 'bike_rate_per_km', value: String(bikeVal) });

        await supabase
          .from('flwdsk_system_settings')
          .upsert({ key: 'car_rate_per_km', value: String(carVal) });
      } catch (dbErr) {
        console.warn('Supabase travel rates upsert warning:', dbErr);
      }

      toast({
        variant: 'success',
        title: 'Travel Rates Updated',
        message: `${rates.length} rates updated (Bike: ₹${bikeVal}/km, Car: ₹${carVal}/km).`,
      });

      onRatesUpdated(rates, bikeVal, carVal);
      onClose();
    } catch (err: any) {
      console.error('Error saving travel rates:', err);
      toast({ variant: 'error', title: 'Save Failed', message: err?.message || 'Could not save rates.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Travel KM Reimbursement Rates">
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: 'var(--primary-50, #eff6ff)',
            border: '1px solid var(--primary-200, #bfdbfe)',
            fontSize: 12,
            color: 'var(--primary-800, #1e40af)',
            fontWeight: 600,
          }}
        >
          ⚙️ CEO / Management Settings: Dynamically configure per-kilometer travel reimbursement rates used across all employee expense claims.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rates.map((rateItem, idx) => (
            <div
              key={rateItem.id || idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
              }}
            >
              {/* Icon selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="kvj-label" style={{ fontSize: 11 }}>Icon</label>
                <select
                  className="kvj-select"
                  value={rateItem.icon || '🚗'}
                  onChange={(e) => handleRateChange(idx, 'icon', e.target.value)}
                  style={{ width: 60, padding: '4px 6px', textAlign: 'center', fontSize: 16 }}
                >
                  {COMMON_ICONS.map((ico) => (
                    <option key={ico} value={ico}>
                      {ico}
                    </option>
                  ))}
                </select>
              </div>

              {/* Vehicle Name */}
              <div style={{ flex: 1 }}>
                <label className="kvj-label" style={{ fontSize: 11 }}>
                  Vehicle / Travel Type <span style={{ color: 'var(--status-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  className="kvj-input"
                  placeholder="e.g. Bike, Car, Auto"
                  value={rateItem.name}
                  onChange={(e) => handleRateChange(idx, 'name', e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Rate per KM */}
              <div style={{ width: 120 }}>
                <label className="kvj-label" style={{ fontSize: 11 }}>
                  Rate/KM (₹) <span style={{ color: 'var(--status-danger)' }}>*</span>
                </label>
                <input
                  type="number"
                  required
                  step="0.1"
                  min="0.5"
                  className="kvj-input"
                  value={rateItem.ratePerKm}
                  onChange={(e) => handleRateChange(idx, 'ratePerKm', Number(e.target.value))}
                  style={{ width: '100%', fontWeight: 700 }}
                />
              </div>

              {/* Delete Rate button */}
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingTop: 18 }}>
                <button
                  type="button"
                  title="Remove this rate"
                  disabled={rates.length <= 1}
                  onClick={() => handleDeleteRate(idx)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: rates.length <= 1 ? 'not-allowed' : 'pointer',
                    color: rates.length <= 1 ? 'var(--text-muted)' : 'var(--status-danger)',
                    fontSize: 18,
                    padding: 4,
                    lineHeight: 1,
                  }}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>

        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleAddRate}
            style={{ width: '100%', borderStyle: 'dashed' }}
          >
            ➕ Add Vehicle / Rate Type
          </Button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Travel Rates'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
export default TravelRatesModal;
