/**
 * Batches — two tabs, per the confirmed spec:
 *   1. Training Details  — the full training lifecycle record per batch
 *   2. Training Calendar — daily trainer allocation grid
 *
 * Each tab renders an existing page component. Those wrap themselves in
 * <AppShell>, which is nesting-safe, so the inner shell renders through.
 */

import { AppShell } from '../../../shared/layout/AppShell';
import { Tabs } from '../../../shared/ui/Tabs';
import { BatchManagement } from './BatchManagement';
import { TrainingCalendar } from './TrainingCalendar';

export function BatchesPage() {
  return (
    <AppShell>
      <Tabs
        items={[
          { id: 'details', label: 'Training Details', content: <BatchManagement /> },
          { id: 'calendar', label: 'Training Calendar', content: <TrainingCalendar /> },
        ]}
      />
    </AppShell>
  );
}

export default BatchesPage;
