const API_BASE_URL = 'http://127.0.0.1:8000';
export type video = {
    id: number;
    title: string;
    file: string;
    duration_seconds: number;
    uploaded_at: string;
};
export type SearchHit = {
    start: number;
    end: number;
    text: string;
    score: number
    frame_url?: string | null;
}
export async function listVideos(): Promise<video[]> {
    const resp = await fetch(`${API_BASE_URL}/api/videos/`);
    if (!resp.ok) {
        // const err = await resp.json().catch(() => ({}));

        throw new Error(`Failed to list videos: ${resp.status} ${resp.statusText}`);
    }
    return resp.json();
}
export async function upload_video(title:string, file:File): Promise<video> {
    const formData = new FormData();
    formData.append("title", title);
    formData.append("file", file);
    const resp = await fetch (`${API_BASE_URL}/api/videos/`, {
        method: "POST",
        body: formData
    });
    if (!resp.ok) {
        throw new Error(`Failed to upload video: ${resp.status} ${resp.statusText}`);
    }
    return resp.json();
}
export async function searchVideo(
  video_id: number,
  query: string,
  includeFrame = true,
  topK = 1
): Promise<{ query: string; results: SearchHit[] }> {
  const params = new URLSearchParams({
    query,
    include_frame: includeFrame ? '1' : '0',
    top_k: String(topK),
  });
  const resp = await fetch(`${API_BASE_URL}/api/videos/${video_id}/search?${params.toString()}`);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to search video: ${resp.status} ${resp.statusText}`);
  }
  return resp.json();
}

export async function transcribe(video_id: number): Promise<void> {
  const resp = await fetch(`${API_BASE_URL}/api/videos/${video_id}/transcribe/`, {
    method: 'POST',
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to transcribe: ${resp.status} ${resp.statusText}`);
  }
}

export async function deleteVideo(video_id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/videos/${video_id}/`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to delete video: ${res.status} ${res.statusText}`);
  }
}

export function toAbsoluteMedia(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE_URL}${url}`;
}
