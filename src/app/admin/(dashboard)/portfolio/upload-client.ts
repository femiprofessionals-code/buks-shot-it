import { finalizeUpload, requestUploads } from "./actions";

export type Progress = { name: string; pct: number; state: "uploading" | "processing" | "done" | "error"; error?: string };

function put(url: string, file: File, onPct: (n: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onPct(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Storage refused the upload (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("The upload was interrupted. Check your connection and try again."));
    xhr.send(file);
  });
}

/** Sends files straight to storage (3 at a time), then asks the server to process each one. */
export async function uploadFiles(galleryId: string, files: File[], onUpdate: (p: Progress[]) => void, replacePhotoId?: string): Promise<string | null> {
  const res = await requestUploads(galleryId, files.map((f) => ({ name: f.name, type: f.type, size: f.size })));
  if (!res.tickets) return res.error ?? "Couldn't start the upload.";
  const progress: Progress[] = files.map((f) => ({ name: f.name, pct: 0, state: "uploading" }));
  const emit = () => onUpdate(progress.map((p) => ({ ...p })));
  emit();
  let next = 0;
  async function worker() {
    while (next < files.length) {
      const i = next++;
      const ticket = res.tickets![i];
      try {
        await put(ticket.url, files[i], (pct) => { progress[i].pct = pct; emit(); });
        progress[i].state = "processing"; emit();
        const r = await finalizeUpload({ galleryId, key: ticket.key, filename: files[i].name, replacePhotoId });
        if (!r.ok) throw new Error(r.error);
        progress[i].state = "done";
      } catch (e) {
        progress[i].state = "error";
        progress[i].error = e instanceof Error ? e.message : "Upload failed.";
      }
      emit();
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  return null;
}
