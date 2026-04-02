import { useState, useCallback } from 'react';
import { useReplayStore } from '../../store/useReplayStore';
import { parseZipFile } from '../../parsing/parseZip';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { uploadMatchToSupabase } from '../../lib/uploadMatchToSupabase';

const btnStyle: React.CSSProperties = {
  padding: '2px 8px',
  fontSize: 11,
  borderRadius: 3,
  border: '1px solid #313244',
  background: '#313244',
  color: '#cdd6f4',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export function UploadDropzone() {
  const loadData = useReplayStore((s) => s.loadData);
  const setLoading = useReplayStore((s) => s.setLoading);
  const isLoading = useReplayStore((s) => s.isLoading);
  const loadError = useReplayStore((s) => s.loadError);
  const openHelp = useReplayStore((s) => s.openHelp);
  const simpleMode = useReplayStore((s) => s.simpleMode);
  const setSimpleMode = useReplayStore((s) => s.setSimpleMode);
  const [isDragging, setIsDragging] = useState(false);
  const [shareMatch, setShareMatch] = useState(false);
  const [uploadNote, setUploadNote] = useState<string | null>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.zip')) {
        setLoading(false, 'Please upload a .zip file');
        return;
      }
      setLoading(true);
      setUploadNote(null);
      try {
        const data = await parseZipFile(file);
        loadData(data);
        if (shareMatch && isSupabaseConfigured()) {
          setUploadNote('Uploading copy to server…');
          void uploadMatchToSupabase(file, data).then((result) => {
            if (result.ok) {
              setUploadNote('Match copy saved for analytics.');
            } else {
              setUploadNote(`Could not upload copy: ${result.message}`);
            }
          });
        }
      } catch (err) {
        setLoading(false, err instanceof Error ? err.message : 'Failed to parse zip file');
      }
    },
    [loadData, setLoading, shareMatch],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void processFile(file);
    },
    [processFile],
  );

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void processFile(file);
    },
    [processFile],
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 24,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 24, fontWeight: 'bold', color: '#89b4fa', marginBottom: 6 }}>
          ProsperityIV Match Visualizer
        </div>
        <div style={{ color: '#7f849c', fontSize: 12 }}>
          Drop your match .zip file to begin analysis
        </div>
        <div style={{ marginTop: 10 }}>
          <button type="button" style={btnStyle} onClick={openHelp} title="Open user guide">
            How to use
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'center', maxWidth: 440, padding: '0 12px' }}>
        <p style={{ color: '#a6adc8', fontSize: 12, lineHeight: 1.5, margin: 0 }}>
          Drop your match log data to get a clear visualization of how you&apos;re performing.
        </p>
      </div>

      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        style={{
          width: 360,
          minHeight: 200,
          border: `2px dashed ${isDragging ? '#89b4fa' : '#45475a'}`,
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: isDragging ? '#1e1e2e88' : '#18182588',
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        <div
          role="group"
          aria-label="Default view after load"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            padding: '8px 10px',
            borderBottom: '1px solid #313244',
            flexShrink: 0,
            background: '#181825',
          }}
        >
          <div style={{ fontSize: 10, color: '#7f849c', marginBottom: 6 }}>
            View after load
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              onClick={() => setSimpleMode(true)}
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: 11,
                borderRadius: 4,
                border: `1px solid ${simpleMode ? '#a6e3a1' : '#313244'}`,
                background: simpleMode ? '#a6e3a122' : 'transparent',
                color: simpleMode ? '#a6e3a1' : '#7f849c',
                cursor: 'pointer',
                fontWeight: simpleMode ? 'bold' : 'normal',
              }}
              title="Plain-language summary and selected charts"
            >
              Simple
            </button>
            <button
              type="button"
              onClick={() => setSimpleMode(false)}
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: 11,
                borderRadius: 4,
                border: `1px solid ${!simpleMode ? '#89b4fa' : '#313244'}`,
                background: !simpleMode ? '#89b4fa22' : 'transparent',
                color: !simpleMode ? '#89b4fa' : '#7f849c',
                cursor: 'pointer',
                fontWeight: !simpleMode ? 'bold' : 'normal',
              }}
              title="Full grid, tabs, and trade ledger"
            >
              Expert
            </button>
          </div>
          {isSupabaseConfigured() && (
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                marginTop: 10,
                cursor: 'pointer',
                fontSize: 10,
                color: '#a6adc8',
                lineHeight: 1.4,
              }}
            >
              <input
                type="checkbox"
                checked={shareMatch}
                onChange={(e) => setShareMatch(e.target.checked)}
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              <span>
                Share this match (original zip + parsed data) for research and analytics. Nothing is sent unless this is checked.
              </span>
            </label>
          )}
        </div>

        <div
          onClick={() => !isLoading && document.getElementById('file-input')?.click()}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            cursor: isLoading ? 'default' : 'pointer',
            minHeight: 132,
            padding: '12px 10px',
          }}
        >
          {isLoading ? (
            <>
              <div style={{ fontSize: 32 }}>⏳</div>
              <div style={{ color: '#89dceb', fontSize: 13 }}>Parsing match data…</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 48 }}>📦</div>
              <div style={{ color: '#cdd6f4', fontSize: 13 }}>
                Drop .zip file here or click to browse
              </div>
              <div style={{ color: '#6c7086', fontSize: 11 }}>
                Contains .json + .log from ProsperityIV
              </div>
            </>
          )}
        </div>
      </div>

      <input
        id="file-input"
        type="file"
        accept=".zip"
        style={{ display: 'none' }}
        onChange={onFileInput}
      />

      {loadError && (
        <div style={{
          color: '#f38ba8',
          background: '#f38ba822',
          border: '1px solid #f38ba844',
          borderRadius: 6,
          padding: '8px 16px',
          fontSize: 12,
          maxWidth: 360,
          textAlign: 'center',
        }}>
          {loadError}
        </div>
      )}

      {uploadNote && (
        <div
          style={{
            color: uploadNote.startsWith('Could not') ? '#fab387' : '#89dceb',
            fontSize: 11,
            maxWidth: 360,
            textAlign: 'center',
            padding: '0 12px',
          }}
        >
          {uploadNote}
        </div>
      )}

      <div style={{ color: '#45475a', fontSize: 10, textAlign: 'center' }}>
        Keyboard shortcuts after loading:<br />
        ← / → = prev/next fill · Shift+←/→ = prev/next mode switch
        <br />
        <span style={{ color: '#5c5f77' }}>Full details in How to use.</span>
      </div>
    </div>
  );
}
