// Mock storage helper for Render deployment
// Converts files to Data URLs to avoid external storage dependencies

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const buffer = Buffer.isBuffer(data) 
    ? data 
    : typeof data === 'string' 
      ? Buffer.from(data) 
      : Buffer.from(data as Uint8Array);
      
  const base64 = buffer.toString('base64');
  const url = `data:${contentType};base64,${base64}`;
  
  return { key: relKey, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  // In this mock, we don't have a way to retrieve the URL just from the key 
  // without the database, but since storagePut returns the full data URL,
  // it will be stored in the DB and extracted from there.
  return {
    key: relKey,
    url: "", 
  };
}
