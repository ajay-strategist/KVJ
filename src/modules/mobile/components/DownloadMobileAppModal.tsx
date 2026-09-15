import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

interface DownloadMobileAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadMobileAppModal: React.FC<DownloadMobileAppModalProps> = ({ isOpen, onClose }) => {
  const [platform, setPlatform] = useState<'android' | 'ios'>('android');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Download / App URLs
  const androidUrl = 'https://expo.dev/artifacts/eas/kvj-flowdesk-mobile-preview.apk';
  const iosUrl = 'https://apps.apple.com/app/expo-go/id982107779';

  const currentUrl = platform === 'android' ? androidUrl : iosUrl;

  useEffect(() => {
    if (!isOpen) return;
    // Generate high-resolution QR code
    QRCode.toDataURL(currentUrl, {
      width: 260,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR generation error:', err));
  }, [platform, isOpen, currentUrl]);

  if (!isOpen) return null;

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `kvj-flowdesk-${platform}-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-surface, #ffffff)',
          color: 'var(--text-primary, #0f172a)',
          borderRadius: 20,
          border: '1px solid var(--border, #e2e8f0)',
          width: '100%',
          maxWidth: 520,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          animation: 'fadeInScale 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-sunken, #f8fafc)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: 'var(--brand, #4338ca)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 22,
                boxShadow: '0 4px 12px rgba(67, 56, 202, 0.3)',
              }}
            >
              📱
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>
                Download KVJ FlowDesk Mobile App
              </h3>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted, #64748b)', marginTop: 2 }}>
                Scan with phone camera or download package directly
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: 'var(--text-muted, #94a3b8)',
              padding: '4px 8px',
              borderRadius: 6,
            }}
          >
            ✕
          </button>
        </div>

        {/* Platform Selector Tabs */}
        <div
          style={{
            display: 'flex',
            padding: '12px 24px 0',
            gap: 12,
            background: 'var(--bg-surface, #ffffff)',
          }}
        >
          <button
            type="button"
            onClick={() => setPlatform('android')}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 12,
              border: `2px solid ${platform === 'android' ? '#10b981' : 'var(--border, #e2e8f0)'}`,
              background: platform === 'android' ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-sunken, #f8fafc)',
              color: platform === 'android' ? '#059669' : 'var(--text-secondary, #64748b)',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: 18 }}>🤖</span> Android APK & Phone
          </button>

          <button
            type="button"
            onClick={() => setPlatform('ios')}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 12,
              border: `2px solid ${platform === 'ios' ? '#4338ca' : 'var(--border, #e2e8f0)'}`,
              background: platform === 'ios' ? 'rgba(67, 56, 202, 0.08)' : 'var(--bg-sunken, #f8fafc)',
              color: platform === 'ios' ? 'var(--brand, #4338ca)' : 'var(--text-secondary, #64748b)',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: 18 }}>🍏</span> iOS (iPhone & iPad)
          </button>
        </div>

        {/* Tab Content Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* QR Code Container */}
          <div
            style={{
              background: '#ffffff',
              padding: 16,
              borderRadius: 16,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              border: '1px solid #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`${platform} QR Code`}
                style={{ width: 220, height: 220, display: 'block', borderRadius: 8 }}
              />
            ) : (
              <div
                style={{
                  width: 220,
                  height: 220,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                }}
              >
                Generating QR...
              </div>
            )}
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                fontWeight: 600,
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              📷 Point phone camera at QR code
            </div>
          </div>

          {/* Action Buttons Row */}
          <div style={{ display: 'flex', gap: 10, width: '100%', marginBottom: 16 }}>
            <button
              type="button"
              onClick={handleDownloadQr}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 10,
                backgroundColor: 'var(--bg-sunken, #f1f5f9)',
                color: 'var(--text-primary, #0f172a)',
                border: '1px solid var(--border, #cbd5e1)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              📥 Download QR Code (PNG)
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                backgroundColor: 'var(--bg-sunken, #f1f5f9)',
                color: 'var(--text-primary, #0f172a)',
                border: '1px solid var(--border, #cbd5e1)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {copied ? '✓ Copied' : '🔗 Copy Link'}
            </button>
          </div>

          {/* Direct Download Action */}
          {platform === 'android' ? (
            <a
              href={androidUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: 12,
                backgroundColor: '#059669',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 14,
                textAlign: 'center',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
                marginBottom: 16,
              }}
            >
              ⬇️ Download Android APK File (.apk)
            </a>
          ) : (
            <a
              href={iosUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: 12,
                backgroundColor: 'var(--brand, #4338ca)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 14,
                textAlign: 'center',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 12px rgba(67, 56, 202, 0.3)',
                marginBottom: 16,
              }}
            >
              🍏 Open in Apple App Store / Expo Go
            </a>
          )}

          {/* Instructions Box */}
          <div
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-sunken, #f8fafc)',
              borderRadius: 12,
              padding: '14px 16px',
              border: '1px solid var(--border, #e2e8f0)',
              fontSize: 12.5,
              color: 'var(--text-secondary, #475569)',
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginBottom: 6 }}>
              {platform === 'android' ? '🤖 Android Installation Steps:' : '🍏 iPhone / iPad Steps:'}
            </div>
            {platform === 'android' ? (
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                <li>Scan the QR code with your phone camera or tap <strong>Download Android APK</strong>.</li>
                <li>When prompted, tap <strong>Download anyway</strong> and install the APK.</li>
                <li>Open <strong>KVJ FlowDesk</strong> and sign in using your employee email and password.</li>
              </ol>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                <li>Open your iPhone's built-in <strong>Camera</strong> app and point it at the QR code.</li>
                <li>Tap the prompt banner to open in <strong>Expo Go</strong> or TestFlight.</li>
                <li>Sign in with your KVJ work email to access real-time attendance and tasks.</li>
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
