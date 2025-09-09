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
  const [metaDuration, setMetaDuration] = useState<number | null>(null);
  const [seekableEnd, setSeekableEnd] = useState<number | null>(null);

  // Pause automatically when reaching the suggested end time
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const updateInfo = () => {
      const d = el.duration;
      setMetaDuration(Number.isFinite(d) ? d : null);
      const s = el.seekable;
      if (s && s.length > 0) {
        setSeekableEnd(s.end(s.length - 1));
      }
    };
    const onTimeUpdate = () => {
      if (segmentEnd != null && el.currentTime >= segmentEnd) {
        el.pause();
        setSegmentEnd(null);
      }
    };
    el.addEventListener('loadedmetadata', updateInfo);
    el.addEventListener('durationchange', updateInfo);
    el.addEventListener('progress', updateInfo);
    el.addEventListener('timeupdate', onTimeUpdate);
    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('loadedmetadata', updateInfo);
      el.removeEventListener('durationchange', updateInfo);
      el.removeEventListener('progress', updateInfo);
    };
  }, [segmentEnd]);

  function normalizeHit(r: SearchHit): { start: number; end: number } {
    const rawStart = r.start ?? 0;
    const rawEnd = r.end ?? rawStart;
    const d = metaDuration ?? videoRef.current?.duration ?? null;

    // Heuristic: if values look like milliseconds, convert once.
    const looksLikeMs = (v: number, dur: number | null) => {
      if (!Number.isFinite(v)) return false;
      if (dur && v > dur * 1.5 && v / 1000 <= dur * 1.5) return true;
      // Also treat very large values as ms if <= 10h when divided
      return v > 600 && v / 1000 < 36000;
    };

    let start = rawStart;
    let end = rawEnd;
    const useMs = looksLikeMs(rawStart, d) || looksLikeMs(rawEnd, d);
    if (useMs) {
      start = rawStart / 1000;
      end = rawEnd / 1000;
    }

    // Clamp to [0, duration]
    if (d && Number.isFinite(d)) {
      start = Math.max(0, Math.min(start, d));
      end = Math.max(0, Math.min(end, d));
    } else {
      start = Math.max(0, start);
      end = Math.max(0, end);
    }
    if (!Number.isFinite(end) || end < start) end = start;
    return { start, end };
  }

  function formatDuration(totalSeconds: number | null | undefined) {
    if (!totalSeconds || !Number.isFinite(totalSeconds)) return '…';
    const s = Math.max(0, Math.round(totalSeconds));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`;
  }

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
        const { start, end } = normalizeHit(top);
        videoRef.current.currentTime = start;
        setSegmentEnd(Number.isFinite(end) ? end : null);
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
        key={video.file}
        ref={videoRef}
        src={toAbsoluteMedia(video.file)}
        controls
        preload="metadata"
        crossOrigin="anonymous"
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
      <small>
        Duration: {metaDuration ? `${metaDuration.toFixed(2)}s` : '…'}
        {seekableEnd != null && (
          <> · Seekable: {seekableEnd.toFixed(2)}s</>
        )}
      </small>
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
                      const { start } = normalizeHit(r);
                      videoRef.current.currentTime = start;
                      setSegmentEnd(null);
                      videoRef.current.play().catch(() => {});
                    }
                  }}
                >
                  {(() => { const { start } = normalizeHit(r); return `Jump to ${start.toFixed(2)}s`; })()}
                </button>
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      const { start, end } = normalizeHit(r);
                      videoRef.current.currentTime = start;
                      setSegmentEnd(Number.isFinite(end) ? end : null);
                      videoRef.current.play().catch(() => {});
                    }
                  }}
                >
                  {(() => { const { start, end } = normalizeHit(r); return `Play ${start.toFixed(2)}s → ${end.toFixed(2)}s`; })()}
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
      <small>Length: {formatDuration(video.duration_seconds)}</small>
    </div>
  );
}
