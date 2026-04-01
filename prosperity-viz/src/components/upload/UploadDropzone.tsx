import { useState, useCallback } from 'react';
import { useReplayStore } from '../../store/useReplayStore';
import { parseZipFile } from '../../parsing/parseZip';

export function UploadDropzone() {
  const loadData = useReplayStore((s) => s.loadData);
  const setLoading = useReplayStore((s) => s.setLoading);
  const isLoading = useReplayStore((s) => s.isLoading);
  const loadError = useReplayStore((s) => s.loadError);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.zip')) {
        setLoading(false, 'Please upload a .zip file');
        return;
      }
      setLoading(true);
      try {
        const data = await parseZipFile(file);
        loadData(data);
      } catch (err) {
        setLoading(false, err instanceof Error ? err.message : 'Failed to parse zip file');
      }
    },
    [loadData, setLoading],
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
      </div>

      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => document.getElementById('file-input')?.click()}
        style={{
          width: 360,
          height: 200,
          border: `2px dashed ${isDragging ? '#89b4fa' : '#45475a'}`,
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          cursor: 'pointer',
          background: isDragging ? '#1e1e2e88' : '#18182588',
          transition: 'border-color 0.15s, background 0.15s',
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

      <div style={{ color: '#45475a', fontSize: 10, textAlign: 'center' }}>
        Keyboard shortcuts after loading:<br />
        ← / → = prev/next fill · Shift+←/→ = prev/next mode switch
      </div>
    </div>
  );
}
