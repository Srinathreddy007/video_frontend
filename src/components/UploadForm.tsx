import { useState, useRef } from 'react';
import { upload_video, transcribe } from '../api';

type Props = {
  onUploaded: () => void;
};

export default function UploadForm({ onUploaded }: Props) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const MAX_DURATION = 180; // seconds

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.src = url;
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const duration = v.duration;
      if (Number.isFinite(duration) && duration > MAX_DURATION) {
        setError('Video must be 3 minutes or less');
        // clear the input so user can pick another file
        if (file.current) file.current.value = '';
      }
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      setError('Could not read video metadata');
      if (file.current) file.current.value = '';
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const f = file.current?.files?.[0];
    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }
    if (!f) {
      setError('Please select a file');
      return;
    }

    try {
      setBusy(true);
      const v = await upload_video(title.trim(), f);
      // Kick off transcription and wait; surface any error
      try {
        await transcribe(v.id);
      } catch (e: any) {
        setError(e?.message || 'Failed to start transcription');
      }
      setTitle('');
      if (file.current) file.current.value = '';
      onUploaded();
    } catch (err: any) {
      setError(err?.message || 'Failed to upload video');
    } finally {
      setBusy(false);
    }
  }

    return (
    <form onSubmit={handleSubmit} className="card">
      <h3>Upload video (≤ 3 min)</h3>
      <label>
        Title
        <input
          type="text"
          placeholder="clip"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        File
        <input ref={file} type="file" accept="video/*" onChange={handleFileChange} />
      </label>
      {error && <div className="error">{error}</div>}
      <button disabled={busy}>{busy ? "Uploading…" : "Upload"}</button>
    </form>
  );
}
