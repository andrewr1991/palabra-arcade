// Family voice — record a native speaker saying words; recordings are
// preferred over TTS everywhere. Stored in IndexedDB per browser.

let db = null;
function idb() {
  return new Promise((res, rej) => {
    if (db) return res(db);
    const rq = indexedDB.open("pa_audio", 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore("clips");
    rq.onsuccess = () => { db = rq.result; res(db); };
    rq.onerror = () => rej(rq.error);
  });
}

export async function saveClip(es, blob) {
  const d = await idb();
  return new Promise((res, rej) => {
    const tx = d.transaction("clips", "readwrite");
    tx.objectStore("clips").put(blob, es);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

export async function getClip(es) {
  try {
    const d = await idb();
    return await new Promise((res) => {
      const rq = d.transaction("clips").objectStore("clips").get(es);
      rq.onsuccess = () => res(rq.result || null);
      rq.onerror = () => res(null);
    });
  } catch { return null; }
}

export async function deleteClip(es) {
  const d = await idb();
  d.transaction("clips", "readwrite").objectStore("clips").delete(es);
}

export async function listClips() {
  try {
    const d = await idb();
    return await new Promise((res) => {
      const rq = d.transaction("clips").objectStore("clips").getAllKeys();
      rq.onsuccess = () => res(rq.result || []);
      rq.onerror = () => res([]);
    });
  } catch { return []; }
}

let rec = null, chunks = [];
export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  rec = new MediaRecorder(stream);
  chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  rec.start();
}
export function stopRecording() {
  return new Promise((res) => {
    rec.onstop = () => {
      rec.stream.getTracks().forEach((t) => t.stop());
      res(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
    };
    rec.stop();
  });
}
export function isRecording() { return rec && rec.state === "recording"; }
