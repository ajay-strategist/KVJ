import React, { useState } from 'react';
import Drawer from '../../../shared/ui/Drawer';
import { Button } from '../../../shared/ui/components';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import { supabase } from '../../../shared/integration/supabase';

export interface TravelRatesModalProps {
  open: boolean;
  onClose: () => void;
  bikeRate: number;
  carRate: number;
  onRatesUpdated: (bike: number, car: number) => void;
}

export function TravelRatesModal({
  open,
  onClose,
  bikeRate: initialBikeRate,
  carRate: initialCarRate,
  onRatesUpdated,
}: TravelRatesModalProps) {
  const { toast } = useNotifications();
  const [bikeRate, setBikeRate] = useState<number>(initialBikeRate);
  const [carRate, setCarRate] = useState<number>(initialCarRate);
  const [saving, setSaving] = useState<boolean>(false);

  if (!open) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Save to localStorage as immediate fallback
      localStorage.setItem('kvj_bike_rate', String(bikeRate));
      localStorage.setItem('kvj_car_rate', String(carRate));

      // Save to Supabase system settings
      const { error: errBike } = await supabase
        .from('flwdsk_system_settings')
        .upsert({ key: 'bike_rate_per_km', value: bikeRate });

      const { error: errCar } = await supabase
        .from('flwdsk_system_settings')
        .upsert({ key: 'car_rate_per_km', value: carRate });

      if (errBike || errCar) {
        console.warn('Supabase travel rates upsert warning:', errBike || errCar);
        toast({
          variant: 'warning',
          title: 'Rates Saved Locally',
          message: 'Rates saved to local storage. Database sync warning.',
        });
      } else {
        toast({
          variant: 'success',
          title: 'Travel Rates Updated',
          message: `Bike: ₹${bikeRate}/km | Car: ₹${carRate}/km updated centrally.`,
        });
      }

      onRatesUpdated(bikeRate, carRate);
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
          ⚙️ CEO Settings: Update central per-kilometer travel reimbursement rates used across all employee expense claims.
        </div>

        <div>
          <label className="kvj-label">
            Bike Rate per KM (₹) <span style={{ color: 'var(--status-danger)' }}>*</span>
          </label>
          <input
            type="number"
            required
            step="0.5"
            min="1"
            className="kvj-input"
            value={bikeRate}
            onChange={(e) => setBikeRate(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label className="kvj-label">
            Car Rate per KM (₹) <span style={{ color: 'var(--status-danger)' }}>*</span>
          </label>
          <input
            type="number"
            required
            step="0.5"
            min="1"
            className="kvj-input"
            value={carRate}
            onChange={(e) => setCarRate(Number(e.target.value))}
            style={{ width: '100%' }}
          />
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
