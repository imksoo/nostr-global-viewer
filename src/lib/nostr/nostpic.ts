import { sha256ToBase64, createNip98AuthorizationHeader } from "./nip98";

const NOSTPIC_NIP96_WELL_KNOWN_URL = "https://nostpic.com/.well-known/nostr/nip96.json";
const NOSTPIC_NIP96_API_URL = "https://nostpic.com/api/v2/nip96";
const NOSTPIC_UPLOAD_URL = "https://nostpic.com/api/v2/media";

type Nip96Config = {
  api_url?: string;
};

type Nip94Tag = [string, string, ...string[]];

type NostpicUploadResponse = {
  status?: string;
  message?: string;
  processing_url?: string;
  nip94_event?: {
    tags?: Nip94Tag[];
  };
  url?: string;
  download_url?: string;
};

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return await response.json() as T;
  } catch {
    return null;
  }
}

function extractUploadUrl(config: Nip96Config | null): string | null {
  if (!config?.api_url || typeof config.api_url !== "string") {
    return null;
  }
  return config.api_url;
}

async function resolveNostpicUploadUrl(): Promise<string> {
  const wellKnownConfig = await fetchJson<Nip96Config>(NOSTPIC_NIP96_WELL_KNOWN_URL);
  const wellKnownUrl = extractUploadUrl(wellKnownConfig);
  if (wellKnownUrl) {
    return wellKnownUrl;
  }

  const apiConfig = await fetchJson<Nip96Config>(NOSTPIC_NIP96_API_URL);
  const apiUrl = extractUploadUrl(apiConfig);
  if (apiUrl) {
    return apiUrl;
  }

  return NOSTPIC_UPLOAD_URL;
}

function findTagValue(tags: Nip94Tag[] | undefined, name: string): string | null {
  const match = tags?.find((tag) => tag[0] === name && typeof tag[1] === "string" && tag[1] !== "");
  return match?.[1] ?? null;
}

async function parseUploadError(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return `nostpic upload failed (${response.status})`;
  }

  try {
    const body = JSON.parse(text) as NostpicUploadResponse;
    return body.message || body.status || `nostpic upload failed (${response.status})`;
  } catch {
    return text;
  }
}

export function extractMediaUrl(body: NostpicUploadResponse): string {
  const url = body.url || body.download_url || findTagValue(body.nip94_event?.tags, "url");
  if (!url) {
    throw new Error("nostpic response did not include a media URL");
  }
  return url;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resolveProcessingUrl(baseUrl: string, processingUrl: string): string {
  return new URL(processingUrl, baseUrl).toString();
}

async function fetchProcessingResult(statusUrl: string): Promise<NostpicUploadResponse> {
  const authorization = await createNip98AuthorizationHeader(statusUrl, "GET");
  const response = await fetch(statusUrl, {
    headers: {
      Authorization: authorization,
    },
  });

  if (!response.ok) {
    throw new Error(await parseUploadError(response));
  }

  return await response.json() as NostpicUploadResponse;
}

async function waitForProcessedMedia(baseUrl: string, processingUrl: string): Promise<string> {
  const statusUrl = resolveProcessingUrl(baseUrl, processingUrl);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const body = await fetchProcessingResult(statusUrl);
    try {
      return extractMediaUrl(body);
    } catch {
      if (!body.processing_url) {
        break;
      }
    }

    await sleep(1000);
  }

  throw new Error("nostpic is still processing the image");
}

export async function uploadImageToNostpic(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("画像ファイルを選択してください");
  }

  const uploadUrl = await resolveNostpicUploadUrl();
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const authorization = await createNip98AuthorizationHeader(uploadUrl, "POST", sha256ToBase64(fileBytes));

  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("uploadtype", "media");
  formData.append("content_type", file.type);
  formData.append("size", String(file.size));

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: authorization,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseUploadError(response));
  }

  const body = await response.json() as NostpicUploadResponse;

  try {
    return extractMediaUrl(body);
  } catch (error) {
    if (body.processing_url) {
      return await waitForProcessedMedia(uploadUrl, body.processing_url);
    }
    throw error;
  }
}
