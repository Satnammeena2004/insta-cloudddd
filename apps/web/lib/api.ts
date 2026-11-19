import { API_URL, clearSession, getValidToken } from "./auth";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getValidToken();
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (res.status === 401 && token) {
    clearSession();
    window.location.href = "/login";
  }
  if (!res.ok) throw new ApiError((await res.json().catch(() => null))?.error ?? res.statusText, res.status);
  return res.status === 204 ? (undefined as T) : res.json();
}

type Signature = { cloudName: string; apiKey: string; timestamp: number; folder: string; signature: string; uploadUrl: string };

/** Guide §3.2 Workflow A: signed token -> direct upload to Cloudinary -> CDN URL. */
export async function uploadToCloudinary(file: File) {
  const sig = await api<Signature>("/posts/upload-signature");
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("folder", sig.folder);
  form.append("signature", sig.signature);
  const res = await fetch(sig.uploadUrl, { method: "POST", body: form });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? "Cloudinary upload failed");
  return { imageUrl: body.secure_url as string, publicId: body.public_id as string };
}
