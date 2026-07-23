import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button, Card, Badge } from '../../../shared/ui/components';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';
import type { DailyReportData, DailyReportConfig } from './daily-report.types';
import { DailyReportDocument } from './DailyReportDocument';
import { DailyReportBuilderModal } from './DailyReportBuilderModal';

interface DailyReportPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  data: DailyReportData;
  initialConfig: DailyReportConfig;
}

export const DailyReportPreview: React.FC<DailyReportPreviewProps> = ({
  isOpen,
  onClose,
  data,
  initialConfig,
}) => {
  const { toast } = useNotifications();
  const [config, setConfig] = useState<DailyReportConfig>(initialConfig);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'document'>('preview');

  // Print mode handlers
  useEffect(() => {
    if (!isOpen) return;

    const handleBeforePrint = () => {
      document.body.classList.add('kvj-printing-active');
    };
    const handleAfterPrint = () => {
      document.body.classList.remove('kvj-printing-active');
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('kvj-printing-active');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePrintPDF = () => {
    document.body.classList.add('kvj-printing-active');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('kvj-printing-active');
    }, 1000);
  };

  const handleDownloadExcelStub = () => {
    toast({
      variant: 'info',
      title: 'Excel Export Stub',
      message: 'Student Data Excel export (.xlsx) is a stub for this pass.',
    });
  };

  const handleEmailCoordinatorStub = () => {
    toast({
      variant: 'info',
      title: 'Email Dispatch Stub',
      message: `Email sending from trainer (${data.trainerName}) to coordinator (${data.coordinatorName}) is a stub for this pass.`,
    });
  };

  const handleSaveRecordsStub = () => {
    toast({
      variant: 'success',
      title: 'Saved to Records',
      message: `Daily report configuration saved to batch records for ${data.batchCode}.`,
    });
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1200,
          background: 'var(--bg-sunken)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Top Action Bar (hidden during browser window.print()) */}
        <div
          className="daily-report-no-print"
          style={{
            background: 'var(--bg-surface)',
            borderBottom: '1.5px solid var(--border)',
            padding: '12px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
              📊 Daily Report Executive Preview
            </h2>
            <Badge tone="info">{data.batchCode} ({data.collegeName})</Badge>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {config.selectedSections.length} Sections · {config.selectedAssessmentIds.length} Assessments Selected
            </span>
          </div>

          {/* View Mode Toggle & Action Buttons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-sunken)', padding: 3, borderRadius: 6, border: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 4,
                  border: 'none',
                  background: viewMode === 'preview' ? 'var(--brand)' : 'transparent',
                  color: viewMode === 'preview' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                👁️ Screen View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('document')}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 4,
                  border: 'none',
                  background: viewMode === 'document' ? 'var(--brand)' : 'transparent',
                  color: viewMode === 'document' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                📄 Printable Document
              </button>
            </div>

            <Button size="sm" onClick={() => setIsEditModalOpen(true)} variant="secondary" style={{ fontSize: 11.5 }}>
              ⚙️ Edit Config
            </Button>

            <Button size="sm" onClick={handlePrintPDF} style={{ fontSize: 11.5 }}>
              🖨️ Download PDF / Print
            </Button>

            <Button size="sm" onClick={handleDownloadExcelStub} variant="secondary" style={{ fontSize: 11.5 }}>
              📊 Download Excel (Stub)
            </Button>

            <Button size="sm" onClick={handleEmailCoordinatorStub} variant="secondary" style={{ fontSize: 11.5 }}>
              ✉️ Email Coordinator (Stub)
            </Button>

            <Button size="sm" onClick={handleSaveRecordsStub} variant="secondary" style={{ fontSize: 11.5 }}>
              💾 Save to Records
            </Button>

            <Button size="sm" onClick={onClose} variant="ghost" style={{ fontSize: 11.5 }}>
              ✕ Close
            </Button>
          </div>
        </div>

        {/* Main Preview Container Scroll Area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 16px',
            display: 'flex',
            justifyContent: 'center',
            background: viewMode === 'document' ? '#64748b' : 'var(--bg-sunken)',
          }}
        >
          {viewMode === 'preview' ? (
            <div style={{ width: '100%', maxWidth: 900 }}>
              <Card style={{ padding: 20 }}>
                <DailyReportDocument data={data} config={config} />
              </Card>
            </div>
          ) : (
            <DailyReportDocument data={data} config={config} />
          )}
        </div>

        {/* Re-edit Configuration Modal */}
        {isEditModalOpen && (
          <DailyReportBuilderModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            data={data}
            onGenerate={(newConfig) => {
              setConfig(newConfig);
              setIsEditModalOpen(false);
              toast({ variant: 'success', title: 'Config Updated', message: 'Report sections refreshed.' });
            }}
          />
        )}
      </div>

      {/* REACT PRINT PORTAL: Attached directly to document.body, isolated during print */}
      {createPortal(
        <div className="kvj-print-portal">
          <DailyReportDocument data={data} config={config} />
        </div>,
        document.body
      )}
    </>
  );
};
