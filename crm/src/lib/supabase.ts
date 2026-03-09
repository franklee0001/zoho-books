import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const BUCKET = "documents";
const LOCAL_STORAGE_DIR = join(process.cwd(), "public", "documents");

let supabaseAdmin: SupabaseClient | null = null;

function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdmin) return supabaseAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  supabaseAdmin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return supabaseAdmin;
}

export async function uploadDocument(
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<{ path: string }> {
  if (!isSupabaseConfigured()) {
    // Fallback: save to local public/documents/
    const localPath = join(LOCAL_STORAGE_DIR, path);
    const dir = localPath.substring(0, localPath.lastIndexOf("/"));
    await mkdir(dir, { recursive: true });
    await writeFile(localPath, buffer);
    return { path };
  }

  const client = getSupabaseAdmin();

  const { data, error } = await client.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType,
      upsert: true,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);
  return { path: data.path };
}

export async function getSignedUrl(
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  if (!isSupabaseConfigured()) {
    // Fallback: serve from local public/documents/
    return `/documents/${path}`;
  }

  const client = getSupabaseAdmin();

  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  return data.signedUrl;
}

export async function deleteDocument(path: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const { unlink } = await import("fs/promises");
    try {
      await unlink(join(LOCAL_STORAGE_DIR, path));
    } catch {
      // ignore if file doesn't exist
    }
    return;
  }

  const client = getSupabaseAdmin();

  const { error } = await client.storage.from(BUCKET).remove([path]);

  if (error) throw new Error(`Delete failed: ${error.message}`);
}
