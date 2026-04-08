const APOLLO_API_KEY = process.env.APOLLO_API_KEY || ""
const APOLLO_BASE = "https://api.apollo.io/api/v1"

interface ApolloSearchParams {
  metro: string // e.g. "Dallas, TX"
  keywords?: string[]
  minEmployees?: number
  maxResults?: number
  page?: number
}

export interface ApolloContact {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  title: string | null
  company: string
  company_domain: string | null
  company_size: string | null
  city: string | null
  state: string | null
  linkedin_url: string | null
}

interface ApolloSearchResponse {
  contacts: ApolloContact[]
  pagination: {
    page: number
    per_page: number
    total_entries: number
    total_pages: number
  }
}

// Default keywords for water damage restoration contractors
const WATER_DAMAGE_KEYWORDS = [
  "water damage restoration",
  "water mitigation",
  "flood restoration",
  "water damage repair",
]

// Metro area mappings for Apollo location search
const METRO_LOCATIONS: Record<string, string[]> = {
  dallas: ["Dallas, Texas", "Fort Worth, Texas", "Plano, Texas", "Arlington, Texas"],
  atlanta: ["Atlanta, Georgia", "Marietta, Georgia", "Decatur, Georgia", "Roswell, Georgia"],
  houston: ["Houston, Texas", "Katy, Texas", "Sugar Land, Texas", "Pasadena, Texas"],
}

export async function searchContractors(params: ApolloSearchParams): Promise<ApolloSearchResponse> {
  const {
    metro,
    keywords = WATER_DAMAGE_KEYWORDS,
    minEmployees = 5,
    maxResults = 25,
    page = 1,
  } = params

  if (!APOLLO_API_KEY) {
    throw new Error("APOLLO_API_KEY not configured")
  }

  const locations = METRO_LOCATIONS[metro.toLowerCase()] || [metro]

  const res = await fetch(`${APOLLO_BASE}/mixed_people/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": APOLLO_API_KEY,
    },
    body: JSON.stringify({
      q_keywords: keywords.join(" OR "),
      person_titles: ["owner", "president", "ceo", "general manager", "operations manager", "founder"],
      person_locations: locations,
      organization_num_employees_ranges: [`${minEmployees},1000`],
      organization_industry_tag_ids: [], // water damage falls under construction/services
      per_page: maxResults,
      page,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Apollo API error (${res.status}): ${err}`)
  }

  const data = await res.json()

  const contacts: ApolloContact[] = (data.people || []).map((p: Record<string, unknown>) => ({
    id: p.id,
    first_name: p.first_name || "",
    last_name: p.last_name || "",
    email: p.email || "",
    phone: (p.phone_numbers as Array<{ sanitized_number: string }> | undefined)?.[0]?.sanitized_number || null,
    title: p.title || null,
    company: (p.organization as Record<string, unknown> | undefined)?.name || "",
    company_domain: (p.organization as Record<string, unknown> | undefined)?.primary_domain || null,
    company_size: (p.organization as Record<string, unknown> | undefined)?.estimated_num_employees?.toString() || null,
    city: p.city || null,
    state: p.state || null,
    linkedin_url: p.linkedin_url || null,
  }))

  return {
    contacts,
    pagination: {
      page: data.pagination?.page || page,
      per_page: data.pagination?.per_page || maxResults,
      total_entries: data.pagination?.total_entries || 0,
      total_pages: data.pagination?.total_pages || 0,
    },
  }
}
