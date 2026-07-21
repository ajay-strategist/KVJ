/**
 * Batches — distinct main tabs:
 *   1. Training Details  — the full training lifecycle record per batch
 *   2. Training Calendar — daily trainer allocation & leave status grid
 */

import { AppShell } from '../../../shared/layout/AppShell';
import { Tabs } from '../../../shared/ui/Tabs';
import { BatchManagement } from './BatchManagement';
import { TrainingCalendar } from './TrainingCalendar';

export function BatchesPage({ defaultTab = 'details' }: { defaultTab?: 'details' | 'calendar' }) {
  return (
    <AppShell>
      <Tabs
        defaultTabId={defaultTab}
        items={[
          { id: 'details', label: '📚 Training Details', content: <BatchManagement /> },
          { id: 'calendar', label: '📅 Training Calendar', content: <TrainingCalendar /> },
        ]}
      />
    </AppShell>
  );
}

export default BatchesPage;
