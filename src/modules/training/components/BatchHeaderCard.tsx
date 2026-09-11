import React from 'react';
import { Button } from '../../../shared/ui/components';
import { TrainingBatchCarousel, type BatchAction } from './TrainingBatchCarousel';
import { cleanBatchCode } from '../utils/batch-formatter';
import type { Batch } from '../training.repository';
import type { Employee } from '../../employee/employee.repository';

export interface BatchHeaderCardProps {
  activeBatch?: Batch | null;
  safeBatches: Batch[];
  courses: any[];
  trainers: Employee[];
  safeTrainers: Employee[];
  selectedTrainerId: string;
  onSelectTrainerId: (id: string) => void;
  selectedBatchId: string;
  onSelectBatchId: (id: string) => void;
  canCreateBatch: boolean;
  onOpenCreateBatch: () => void;
  onCarouselAction: (batchId: string, action: BatchAction) => void;
  onEditBatch: (batch: Batch) => void;
  onCopyBatch: (batch: Batch) => void;
  onDeleteBatch?: (batchId: string) => void;
}

export const BatchHeaderCard: React.FC<BatchHeaderCardProps> = ({
  activeBatch,
  safeBatches,
  courses,
  trainers,
  safeTrainers,
  selectedTrainerId,
  onSelectTrainerId,
  selectedBatchId,
  onSelectBatchId,
  canCreateBatch,
  onOpenCreateBatch,
  onCarouselAction,
  onEditBatch,
  onCopyBatch,
  onDeleteBatch,
}) => {
  return (
    <div style={{ marginBottom: 20 }}>
      {/* Top Bar with Add Batch Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            🎓 Training Batch Management & Analytics
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Batch: <strong>{cleanBatchCode(activeBatch?.code, activeBatch?.batchNo) || 'Select a batch'}</strong> ({activeBatch?.college || 'KVJ Analytics'})
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {safeTrainers.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-surface)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>👤 Trainer:</span>
              <select
                className="kvj-select"
                value={selectedTrainerId}
                onChange={(e) => {
                  onSelectTrainerId(e.target.value);
                  onSelectBatchId('');
                }}
                style={{ padding: '4px 8px', fontSize: 12, borderRadius: 'var(--radius-xs)', minWidth: 160 }}
              >
                <option value="all">👥 All Trainers</option>
                {safeTrainers.map((emp) => {
                  const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email;
                  return <option key={emp.id} value={emp.id}>{name}</option>;
                })}
              </select>
            </div>
          )}

          {canCreateBatch && (
            <Button onClick={onOpenCreateBatch}>
              ➕ Add New Batch
            </Button>
          )}
        </div>
      </div>

      {/* Training Batch Overview Carousel */}
      <TrainingBatchCarousel
        batches={safeBatches}
        courses={courses}
        trainers={trainers}
        activeId={selectedBatchId}
        onSelect={onSelectBatchId}
        onAction={onCarouselAction}
        onEdit={onEditBatch}
        onCopy={onCopyBatch}
        onDelete={onDeleteBatch}
      />
    </div>
  );
};
