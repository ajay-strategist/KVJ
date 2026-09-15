import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

interface DownloadMobileAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadMobileAppModal: React.FC<DownloadMobileAppModalProps> = ({ isOpen, onClose }) => {
  const [platform, setPlatform] = useState<'android' | 'ios'>('android');
  const [iosMode, setIosMode] = useState<'instant' | 'testflight'>('instant');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Dynamic distribution URLs with resilient fallbacks
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kvj-alpha.vercel.app';
  const androidUrl = import.meta.env.VITE_MOBILE_APK_URL || `${origin}/downloads/kvj-flowdesk.apk`;
  const iosInstantUrl = `${origin}/app?source=mobile_ios`;
  const iosTestFlightUrl = import.meta.env.VITE_IOS_TESTFLIGHT_URL || 'https://testflight.apple.com/join/kvjflowdesk';

  const currentUrl = platform === 'android' ? androidUrl : (iosMode === 'instant' ? iosInstantUrl : iosTestFlightUrl);

  useEffect(() => {
    if (!isOpen) return;
    // Generate high-contrast, scannable QR code
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
  }, [platform, iosMode, isOpen, currentUrl]);

  if (!isOpen) return null;

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `kvj-flowdesk-${platform}-${platform === 'ios' ? iosMode : 'apk'}-qr.png`;
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
        backdropFilter: 'blur(8px)',
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
          borderRadius: 24,
          border: '1px solid var(--border, #e2e8f0)',
          width: '100%',
          maxWidth: 540,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
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
                backgroundColor: '#4338ca',
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
                KVJ FlowDesk Mobile
              </h3>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted, #64748b)', marginTop: 2 }}>
                Install on Android and iOS (iPhone / iPad)
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
            padding: '16px 24px 0',
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
              borderRadius: 14,
              border: `2px solid ${platform === 'android' ? '#10b981' : 'var(--border, #e2e8f0)'}`,
              background: platform === 'android' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-sunken, #f8fafc)',
              color: platform === 'android' ? '#047857' : 'var(--text-secondary, #64748b)',
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
              borderRadius: 14,
              border: `2px solid ${platform === 'ios' ? '#4338ca' : 'var(--border, #e2e8f0)'}`,
              background: platform === 'ios' ? 'rgba(67, 56, 202, 0.1)' : 'var(--bg-sunken, #f8fafc)',
              color: platform === 'ios' ? '#4338ca' : 'var(--text-secondary, #64748b)',
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

        {/* iOS Sub-Mode Switcher */}
        {platform === 'ios' && (
          <div
            style={{
              display: 'flex',
              margin: '14px 24px 0',
              padding: 4,
              backgroundColor: 'var(--bg-sunken, #f1f5f9)',
              borderRadius: 12,
              gap: 6,
            }}
          >
            <button
              type="button"
              onClick={() => setIosMode('instant')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: iosMode === 'instant' ? '#ffffff' : 'transparent',
                color: iosMode === 'instant' ? '#0f172a' : '#64748b',
                fontWeight: iosMode === 'instant' ? 700 : 500,
                fontSize: 12.5,
                cursor: 'pointer',
                boxShadow: iosMode === 'instant' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              <span>⚡</span> Instant App (Home Screen)
            </button>
            <button
              type="button"
              onClick={() => setIosMode('testflight')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: iosMode === 'testflight' ? '#ffffff' : 'transparent',
                color: iosMode === 'testflight' ? '#0f172a' : '#64748b',
                fontWeight: iosMode === 'testflight' ? 700 : 500,
                fontSize: 12.5,
                cursor: 'pointer',
                boxShadow: iosMode === 'testflight' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              <span>✈️</span> Apple TestFlight (Beta)
            </button>
          </div>
        )}

        {/* Tab Content Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* QR Code Container */}
          <div
            style={{
              background: '#ffffff',
              padding: 16,
              borderRadius: 20,
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
                style={{ width: 210, height: 210, display: 'block', borderRadius: 8 }}
              />
            ) : (
              <div
                style={{
                  width: 210,
                  height: 210,
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
              📷 {platform === 'android' ? 'Scan to download APK directly' : (iosMode === 'instant' ? 'Scan with iPhone Camera' : 'Scan to join TestFlight')}
            </div>
          </div>

          {/* Action Buttons Row */}
          <div style={{ display: 'flex', gap: 10, width: '100%', marginBottom: 14 }}>
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
              📥 Save QR Code
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

          {/* Direct Action Link / Button */}
          {platform === 'android' ? (
            <a
              href={androidUrl}
              download="kvj-flowdesk.apk"
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: 14,
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
                boxShadow: '0 4px 14px rgba(5, 150, 105, 0.3)',
                marginBottom: 16,
              }}
            >
              ⬇️ Download Android APK Package (.apk)
            </a>
          ) : iosMode === 'instant' ? (
            <a
              href={iosInstantUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: 14,
                backgroundColor: '#0284c7',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 14,
                textAlign: 'center',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)',
                marginBottom: 16,
              }}
            >
              🌐 Open KVJ FlowDesk in Safari (iPhone)
            </a>
          ) : (
            <a
              href={iosTestFlightUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: 14,
                backgroundColor: '#4338ca',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 14,
                textAlign: 'center',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(67, 56, 202, 0.3)',
                marginBottom: 16,
              }}
            >
              ✈️ Join Apple TestFlight Beta
            </a>
          )}

          {/* Platform Specific Walkthrough Box */}
          <div
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-sunken, #f8fafc)',
              borderRadius: 14,
              padding: '14px 16px',
              border: '1px solid var(--border, #e2e8f0)',
              fontSize: 12.5,
              color: 'var(--text-secondary, #475569)',
              lineHeight: 1.6,
            }}
          >
            {platform === 'android' ? (
              <>
                <div style={{ fontWeight: 700, color: '#047857', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🤖</span> Android Installation Steps:
                </div>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  <li>Tap <strong>Download Android APK</strong> or scan the QR code above with your phone camera.</li>
                  <li>If prompted with <em>"File might be harmful"</em>, tap <strong>Download anyway</strong> (standard notice for enterprise APK downloads).</li>
                  <li>Tap <strong>Open</strong> ➔ <strong>Install</strong> (enable <em>"Install unknown apps"</em> for your browser if prompted).</li>
                  <li>Open <strong>KVJ FlowDesk</strong> and log in with your KVJ employee email.</li>
                </ol>
              </>
            ) : iosMode === 'instant' ? (
              <>
                <div style={{ fontWeight: 700, color: '#0284c7', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🍏</span> iPhone / iPad: Add to Home Screen (Instant App):
                </div>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  <li>Open your iPhone <strong>Camera</strong> and point it at the QR code (or open the link in Safari).</li>
                  <li>At the bottom of Safari, tap the <strong>Share icon</strong> (square with arrow pointing up 📤).</li>
                  <li>Scroll down and select <strong>"Add to Home Screen"</strong> (➕).</li>
                  <li>Tap <strong>Add</strong> in the top right. <strong>KVJ FlowDesk</strong> will install directly onto your iPhone home screen with native GPS attendance and camera access!</li>
                </ol>
                <div style={{ marginTop: 8, padding: '6px 10px', backgroundColor: 'rgba(2, 132, 199, 0.08)', borderRadius: 8, fontSize: 11.5, color: '#0369a1' }}>
                  💡 <strong>No App Store Required:</strong> Runs as a standalone app with full offline support and instant updates.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, color: '#4338ca', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>✈️</span> iPhone: Apple TestFlight Beta Steps:
                </div>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  <li>Install <strong>Apple TestFlight</strong> from the App Store on your iPhone.</li>
                  <li>Tap <strong>Join Apple TestFlight Beta</strong> or scan the QR code to accept the invitation.</li>
                  <li>Tap <strong>Install</strong> inside TestFlight to download the native iOS build.</li>
                </ol>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
