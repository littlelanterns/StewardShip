import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../shared';

interface DataPrivacySectionProps {
  onExportAllData: () => Promise<Blob | null>;
  onDownloadBlob: (blob: Blob, filename: string) => void;
  onBackfillCloneAll?: () => Promise<void>;
}

export function DataPrivacySection({
  onExportAllData,
  onDownloadBlob,
  onBackfillCloneAll,
}: DataPrivacySectionProps) {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [exportError, setExportError] = useState('');
  const [cloning, setCloning] = useState(false);
  const [cloneDone, setCloneDone] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    setExportError('');
    setExportDone(false);

    const blob = await onExportAllData();
    if (blob) {
      const date = new Date().toISOString().split('T')[0];
      onDownloadBlob(blob, `StewardShip_Export_${date}.zip`);
      setExportDone(true);
    } else {
      setExportError('Export failed. Please try again.');
    }
    setExporting(false);
  };

  return (
    <div className="settings-section__body">
      {/* Export All Data */}
      <div className="settings-field">
        <label className="settings-field__label">Export All Data</label>
        <p className="settings-field__description">
          Download a complete copy of all your data as a ZIP file.
        </p>
        <Button variant="secondary" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Generating export...' : 'Export All Data'}
        </Button>
        {exportDone && (
          <div className="settings-field__success">Export downloaded successfully</div>
        )}
        {exportError && (
          <div className="settings-field__error">{exportError}</div>
        )}
      </div>

      {/* Export Journal as PDF */}
      <div className="settings-field">
        <label className="settings-field__label">Export Journal as PDF</label>
        <p className="settings-field__description">
          Generate a printable PDF of your journal entries with date range and type filters.
        </p>
        <Button variant="secondary" onClick={() => navigate('/journal?export=true')}>
          Export Journal
        </Button>
      </div>

      {/* Clone Library to All Users */}
      {onBackfillCloneAll && (
        <div className="settings-field">
          <label className="settings-field__label">Clone Library to All Users</label>
          <p className="settings-field__description">
            Copy all your Manifest books and extractions to every other user in the app.
          </p>
          <Button
            variant="secondary"
            onClick={async () => {
              setCloning(true);
              setCloneDone(false);
              await onBackfillCloneAll();
              setCloning(false);
              setCloneDone(true);
            }}
            disabled={cloning}
          >
            {cloning ? 'Cloning...' : 'Clone All Books'}
          </Button>
          {cloneDone && (
            <div className="settings-field__success">Library cloned to all users</div>
          )}
        </div>
      )}

      {/* Data Storage Info */}
      <div className="settings-field">
        <label className="settings-field__label">Data Storage</label>
        <p className="settings-field__description">
          Your data is stored securely on Supabase servers. All AI conversations are processed
          through your selected AI provider. StewardShip does not sell or share your data.
        </p>
      </div>
    </div>
  );
}
