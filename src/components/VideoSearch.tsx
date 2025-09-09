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
  const [srcUrl, setSrcUrl] = useState<string>(() => toAbsoluteMedia(video.file));
  const [usingBlob, setUsingBlob] = useState<boolean>(false);

  useEffect(() => {
    setSrcUrl(toAbsoluteMedia(video.file));
    setUsingBlob(false);
    setMetaDuration(null);
    setSeekableEnd(null);
    setSegmentEnd(null);
  }, [video.file]);

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

  useEffect(() => {
    const libDur = video.duration_seconds;
    if (usingBlob) return; // already swapped
    if (!libDur || !Number.isFinite(libDur)) return;
    if (metaDuration == null) return; // wait for metadata

    const looksWrong = metaDuration < libDur - 0.75; // 750ms tolerance
    if (!looksWrong) return;

    let aborted = false;
    (async () => {
      try {
        const resp = await fetch(toAbsoluteMedia(video.file));
        if (!resp.ok) return;
        const blob = await resp.blob();
        if (aborted) return;
        const url = URL.createObjectURL(blob);
        // Revoke previous blob url if any
        if (usingBlob) {
          URL.revokeObjectURL(srcUrl);
        }
        setSrcUrl(url);
        setUsingBlob(true);
      } catch (_) {
      }
    })();

    return () => {
      aborted = true;
    };
  }, [metaDuration, video.duration_seconds, video.file, usingBlob, srcUrl]);

  // Parse seconds from number, numeric string, "12.3s", or "hh:mm:ss(.ms)"/"mm:ss(.ms)"
  function parseTimeLike(v: any): number | null {
    if (v == null) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const s = String(v).trim();
    if (!s) return null;
    // 12.3 or 12.3s
    if (/^\d+(?:\.\d+)?s?$/.test(s)) {
      const num = parseFloat(s.replace(/s$/, ''));
      return Number.isFinite(num) ? num : null;
    }
    const m = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
    if (m) {
      const hh = m[1] ? parseInt(m[1], 10) : 0;
      const mm = parseInt(m[2], 10);
      const ss = parseFloat(m[3]);
      if ([hh, mm, ss].every(Number.isFinite)) return hh * 3600 + mm * 60 + ss;
    }
    const num = parseFloat(s);
    return Number.isFinite(num) ? num : null;
  }

  function normalizeHit(r: SearchHit | Record<string, any>): { start: number; end: number } {
    const pick = (obj: any, keys: string[], fallback: number) => {
      for (const k of keys) {
        const v = obj?.[k];
        const n = parseTimeLike(v);
        if (n != null && Number.isFinite(n)) return n;
      }
      return fallback;
    };
    const rawStart = pick(r as any, [
      'start', 'start_time', 'startTime', 'start_timestamp', 'start_ts', 'ts_start', 'startSec', 'start_seconds'
    ], 0);
    const rawEnd = pick(r as any, [
      'end', 'end_time', 'endTime', 'end_timestamp', 'end_ts', 'ts_end', 'endSec', 'end_seconds'
    ], rawStart);

    const libDur = Number.isFinite(video.duration_seconds) ? video.duration_seconds : null;
    const d = libDur ?? (metaDuration ?? videoRef.current?.duration ?? null);

    const looksLikeMs = (v: number, dur: number | null) => {
      if (!Number.isFinite(v)) return false;
      if (dur && v > dur * 1.5 && v / 1000 <= dur * 1.5) return true;
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

  async function seekAndMaybePlay(start: number, end?: number) {
    const el = videoRef.current;
    if (!el) return;
    const ensureMeta = () => new Promise<void>((resolve) => {
      if (el.readyState >= 1 && Number.isFinite(el.duration)) return resolve();
      const onMeta = () => { el.removeEventListener('loadedmetadata', onMeta); resolve(); };
      el.addEventListener('loadedmetadata', onMeta);
    });
    await ensureMeta();
    el.currentTime = Math.max(0, start);
    if (Number.isFinite(end ?? NaN)) setSegmentEnd(end!);
    el.play().catch(() => {});
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
      const data = await searchVideo(video.id, q.trim(), true, 1);
      setResults((data.results || []).slice(0, 1));
      if (data.results?.length && videoRef.current) {
        const top = data.results[0];
        const { start, end } = normalizeHit(top);
        await seekAndMaybePlay(start, end);
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
        key={srcUrl}
        ref={videoRef}
        src={srcUrl}
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
        Duration: {metaDuration ? `${metaDuration.toFixed(2)}s` : '…'} · Source: {usingBlob ? 'blob' : 'remote'}
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
                  onClick={async () => {
                    if (!videoRef.current) return;
                    const { start } = normalizeHit(r);
                    setSegmentEnd(null);
                    await seekAndMaybePlay(start);
                  }}
                >
                  {(() => { const { start } = normalizeHit(r); return `Jump to ${start.toFixed(2)}s`; })()}
                </button>
                <button
                  onClick={async () => {
                    if (!videoRef.current) return;
                    const { start, end } = normalizeHit(r);
                    await seekAndMaybePlay(start, end);
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
