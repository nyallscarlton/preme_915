import { createClient } from "@/lib/supabase/client"

const BUCKET = "documents"

/**
 * Upload a document to Supabase Storage.
 * Client-side helper — uses the browser Supabase client.
 */
export async function uploadDocument(
  file: File,
  applicationId: string,
  category: string
): Promise<{ url: string; path: string }> {
  const supabase = createClient()
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
  const path = `applications/${applicationId}/${category}/${safeName}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)

  return { url: urlData.publicUrl, path }
}

/**
 * List all documents for an application.
 * Iterates over known category prefixes and aggregates results.
 */
export async function listDocuments(
  applicationId: string
): Promise<Array<{ name: string; path: string; url: string; category: string; created_at: string }>> {
  const supabase = createClient()
  const prefix = `applications/${applicationId}`

  const { data: folders, error: folderError } = await supabase.storage
    .from(BUCKET)
    .list(prefix, { limit: 100 })

  if (folderError || !folders) return []

  const results: Array<{ name: string; path: string; url: string; category: string; created_at: string }> = []

  for (const folder of folders) {
    // Each folder is a category
    const categoryPath = `${prefix}/${folder.name}`
    const { data: files } = await supabase.storage
      .from(BUCKET)
      .list(categoryPath, { limit: 100 })

    if (!files) continue

    for (const file of files) {
      if (!file.name) continue
      const filePath = `${categoryPath}/${file.name}`
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath)

      results.push({
        name: file.name.replace(/^\d+-/, ""), // Strip timestamp prefix for display
        path: filePath,
        url: urlData.publicUrl,
        category: folder.name,
        created_at: file.created_at || new Date().toISOString(),
      })
    }
  }

  return results
}

/**
 * Delete a document from Supabase Storage.
 */
export async function deleteDocument(path: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.storage.from(BUCKET).remove([path])

  if (error) {
    throw new Error(`Delete failed: ${error.message}`)
  }
}
