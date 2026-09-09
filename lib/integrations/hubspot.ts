import { Target } from "../linkedin/runner";

const HS_API = "https://api.hubapi.com/crm/v3/objects/contacts";

export interface HubSpotConfig {
  apiKey: string;
}

export class HubSpotError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data: any) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = "HubSpotError";
  }
}

async function request(url: string, config: HubSpotConfig, options: RequestInit, retries = 3): Promise<any> {
  const headers = {
    "Authorization": `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, { ...options, headers });
    
    if (res.ok) {
      if (res.status === 204) return null;
      return await res.json();
    }

    if (res.status === 429) {
      if (attempt === retries) throw new HubSpotError("Rate limit exceeded", 429, null);
      const retryAfter = res.headers.get("Retry-After");
      const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
      console.warn(`[HubSpot] 429 Rate limit. Waiting ${waitMs}ms before retry ${attempt}/${retries}...`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }

    if (res.status >= 500 && attempt < retries) {
      console.warn(`[HubSpot] ${res.status} Server error. Waiting 2000ms before retry...`);
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    let data;
    try { data = await res.json(); } catch { data = await res.text(); }
    
    throw new HubSpotError(`HubSpot API Error: ${res.status} ${res.statusText}`, res.status, data);
  }
}

export async function searchContact(target: Target, config: HubSpotConfig): Promise<{ total: number; results: any[] }> {
  const filters = [];
  if (target.email) {
    filters.push({ propertyName: "email", operator: "EQ", value: target.email });
  }
  if (target.linkedin_url) {
    filters.push({ propertyName: "hs_linkedin_url", operator: "EQ", value: target.linkedin_url });
  }

  if (filters.length === 0) {
    return { total: 0, results: [] };
  }

  const payload = {
    filterGroups: filters.map(f => ({ filters: [f] })), // OR logic: each filter in a separate group
    properties: ["email", "hs_linkedin_url", "firstname", "lastname"]
  };

  const data = await request(`${HS_API}/search`, config, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return { total: data.total, results: data.results };
}

function mapProperties(target: Target) {
  const props: Record<string, string> = {};
  if (target.first_name) props.firstname = target.first_name;
  if (target.last_name) props.lastname = target.last_name;
  if (target.email) props.email = target.email;
  if (target.company) props.company = target.company;
  if (target.title) props.jobtitle = target.title;
  if (target.linkedin_url) props.hs_linkedin_url = target.linkedin_url;
  return props;
}

export async function createContact(target: Target, config: HubSpotConfig): Promise<string> {
  try {
    const data = await request(HS_API, config, {
      method: "POST",
      body: JSON.stringify({ properties: mapProperties(target) })
    });
    return data.id;
  } catch (err: any) {
    if (err instanceof HubSpotError && err.status === 409) {
      // Race condition fallback
      const match = err.data?.message?.match(/Existing ID: (\d+)/);
      if (match && match[1]) {
        console.log(`[HubSpot] 409 Conflict fallback. Extracting ID: ${match[1]}`);
        return await updateContact(match[1], target, config);
      }
    }
    throw err;
  }
}

export async function updateContact(id: string, target: Target, config: HubSpotConfig): Promise<string> {
  const data = await request(`${HS_API}/${id}`, config, {
    method: "PATCH",
    body: JSON.stringify({ properties: mapProperties(target) })
  });
  return data.id;
}

export async function upsertContact(target: Target, config: HubSpotConfig): Promise<{ id: string; action: "created" | "updated" }> {
  const search = await searchContact(target, config);
  
  if (search.total === 0) {
    const id = await createContact(target, config);
    return { id, action: "created" };
  }
  
  if (search.total === 1) {
    const id = search.results[0].id;
    await updateContact(id, target, config);
    return { id, action: "updated" };
  }
  
  throw new Error(`AMBIGUOUS_DUPLICATE: Found ${search.total} contacts matching email or linkedin_url.`);
}
