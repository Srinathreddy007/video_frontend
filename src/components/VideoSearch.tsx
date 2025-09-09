import React, { useEffect, useRef, useState } from "react";
import type { video as Video, SearchHit } from "../api";
import { searchVideo, toAbsoluteMedia, transcribe } from "../api";

type Props = {
  video: Video;
};

export default function VideoSearch({ video }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transcribed, setTranscribed] = useState<boolean>(false);
  const [segmentEnd, setSegmentEnd] = useState<number | null>(null);

  // Pause automatically when reaching the suggested end time
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onTimeUpdate = () => {
      if (segmentEnd != null && el.currentTime >= segmentEnd) {
        el.pause();
        setSegmentEnd(null);
      }
    };
    el.addEventListener('timeupdate', onTimeUpdate);
    return () => el.removeEventListener('timeupdate', onTimeUpdate);
  }, [segmentEnd]);

  async function ensureTranscribed() {
    try {
      await transcribe(video.id);
    } catch (e: any) {
      if (!String(e?.message || "").includes("already")) throw e;
    }
    setTranscribed(true);
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!q.trim()) return;
    try {
      setBusy(true);
      if (!transcribed) await ensureTranscribed();
      const data = await searchVideo(video.id, q.trim(), true, 3);
      setResults(data.results || []);
      if (data.results?.length && videoRef.current) {
        const top = data.results[0];
        videoRef.current.currentTime = top.start;
        setSegmentEnd(Number.isFinite(top.end) ? top.end : null);
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      setError(err.message || "Search failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h3>{video.title}</h3>
      <video
        ref={videoRef}
        src={toAbsoluteMedia(video.file)}
        controls
        style={{ width: "100%", borderRadius: 12 }}
      />
      <form onSubmit={onSearch} className="row">
        <input
          type="text"
          placeholder='Ask: "When are new features mentioned?"'
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button disabled={busy}>{busy ? "Searching…" : "Search"}</button>
      </form>
      {error && <div className="error">{error}</div>}

      {results && (
        <div className="results">
          <h4>Matches</h4>
          {results.length === 0 && <p>No match found.</p>}
          {results.map((r, i) => (
            <div className="hit" key={i}>
              <div className="hit-meta">
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = r.start;
                      setSegmentEnd(null);
                      videoRef.current.play().catch(() => {});
                    }
                  }}
                >
                  Jump to {r.start.toFixed(2)}s
                </button>
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = r.start;
                      setSegmentEnd(Number.isFinite(r.end) ? r.end : null);
                      videoRef.current.play().catch(() => {});
                    }
                  }}
                >
                  Play {r.start.toFixed(2)}s → {r.end.toFixed(2)}s
                </button>
                <small>score: {r.score.toFixed(3)}</small>
              </div>
              <div className="hit-body">
                {r.frame_url && (
                  <img
                    src={toAbsoluteMedia(r.frame_url)}
                    alt="thumbnail"
                    width={180}
                    style={{ borderRadius: 8 }}
                  />
                )}
                <p>{r.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
