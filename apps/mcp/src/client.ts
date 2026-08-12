const baseUrl = (process.env.FIGMA_MIRROR_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
export async function api<T>(path: string): Promise<T> { const response = await fetch(`${baseUrl}${path}`); if (!response.ok) throw new Error(`Figma Mirror API ${response.status}: ${await response.text()}`); return response.json() as Promise<T>; }
export async function binary(path: string) { const response = await fetch(`${baseUrl}${path}`); if (!response.ok) throw new Error(`Figma Mirror API ${response.status}`); return { bytes: new Uint8Array(await response.arrayBuffer()), mimeType: response.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream" }; }
export { baseUrl };
