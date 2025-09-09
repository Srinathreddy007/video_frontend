import { useEffect, useState } from "react";
import { listVideos, deleteVideo } from "./api";
import type { video as Video } from "./api";
import UploadForm from "./components/UploadForm";
import VideoSearch from "./components/VideoSearch";

export default function App() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await listVideos();
      setVideos(data);
      if (data.length && selected === null) setSelected(data[0].id);
    } catch (e: any) {
      setError(e?.message || 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this video?')) return;
    setError(null);
    setDeletingId(id);
    try {
      await deleteVideo(id);
      setVideos((prev) => prev.filter((v) => v.id !== id));
      if (selected === id) setSelected(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to delete video');
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const active = videos.find((v) => v.id === selected) || null;

  return (
    <div className="container">
      <header>
        <h2>Video Search Demo</h2>
      </header>

      <main className="grid">
        <div>
          <UploadForm onUploaded={refresh} />
          <div className="card">
            <h3>Library</h3>
            {error && <div className="error">{error}</div>}
            {loading && <p>Loading…</p>}
            {!loading && !videos.length && <p>No videos yet.</p>}
            <ul className="list">
              {videos.map((v) => (
                <li key={v.id}>
                  <div className="row" style={{ alignItems: 'stretch' }}>
                    <button
                      className={`link ${selected === v.id ? "active" : ""}`}
                      onClick={() => setSelected(v.id)}
                      style={{ flex: 1 }}
                    >
                      {v.title} <small>({v.duration_seconds}s)</small>
                    </button>
                    <button
                      onClick={() => handleDelete(v.id)}
                      disabled={deletingId === v.id}
                      title="Delete video"
                    >
                      {deletingId === v.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>{active ? <VideoSearch video={active} /> : <EmptyState />}</div>
      </main>

      <footer>
        <small>Backend: {import.meta.env.VITE_API_BASE}</small>
      </footer>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card">
      <h3>No video selected</h3>
      <p>Upload or pick a video on the left.</p>
    </div>
  );
}
