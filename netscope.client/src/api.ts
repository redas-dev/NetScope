export interface User {
  id: string;
  email: string;
  role: "User" | "Admin";
}
export interface Session {
  expiresAt: string;
  user: User;
}
export interface Location {
  id: string;
  name: string;
  address: string;
  description: string | null;
  ownerId: string;
  createdAt: string;
}
export interface Device {
  id: string;
  locationId: string;
  name: string;
  type: string;
  ipAddress: string;
  macAddress: string;
  status: string;
}
export interface Client {
  id: string;
  deviceId: string;
  name: string;
  type: string;
  ipAddress: string;
  macAddress: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export class ApiError extends Error {
  status: number;
  fields: Record<string, string[]>;
  constructor(
    status: number,
    message: string,
    fields: Record<string, string[]> = {},
  ) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

let refreshPending: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshPending)
    refreshPending = fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "same-origin",
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPending = null;
      });
  return refreshPending;
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: "same-origin",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(
      0,
      "Nepavyko pasiekti serverio. Patikrinkite ryšį ir bandykite dar kartą.",
    );
  }
  if (!response.ok) {
    if (
      response.status === 401 &&
      retry &&
      !path.startsWith("/api/auth/login") &&
      !path.startsWith("/api/auth/register") &&
      !path.startsWith("/api/auth/refresh") &&
      !path.startsWith("/api/auth/logout") &&
      (await refreshSession())
    )
      return request<T>(path, options, false);
    const problem = await response.json().catch(() => ({}));
    if (response.status === 401 && path !== "/api/auth/me")
      window.dispatchEvent(new Event("netscope:expired"));
    const messages: Record<number, string> = {
      400: "Patikrinkite formos laukus. Pateikti duomenys netinkami.",
      401:
        path === "/api/auth/login"
          ? "Neteisingas el. paštas arba slaptažodis."
          : "Sesija baigėsi. Prisijunkite iš naujo.",
      403: "Neturite teisės atlikti šio veiksmo.",
      404: "Įrašas nerastas arba jau pašalintas.",
      409:
        problem.title ||
        "Toks įrašas jau egzistuoja arba duomenys buvo pakeisti.",
      429: "Per daug užklausų. Šiek tiek palaukite ir bandykite dar kartą.",
    };
    throw new ApiError(
      response.status,
      messages[response.status] || "Serverio klaida. Bandykite dar kartą.",
      problem.errors,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const write = <T>(path: string, method: string, body?: unknown) =>
  request<T>(path, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
export const locationPath = (id: string) =>
  `/api/locations/${encodeURIComponent(id)}`;
export const devicePath = (locationId: string, id: string) =>
  `${locationPath(locationId)}/devices/${encodeURIComponent(id)}`;
export const clientPath = (locationId: string, deviceId: string, id: string) =>
  `${devicePath(locationId, deviceId)}/clients/${encodeURIComponent(id)}`;

export async function allPages<T>(
  path: string,
  signal: AbortSignal,
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const result = await request<Page<T>>(
      `${path}${path.includes("?") ? "&" : "?"}page=${page}&pageSize=100`,
      { signal },
    );
    items.push(...result.items);
    if (items.length >= result.total || !result.items.length) return items;
  }
}

export const deviceTypes: Record<string, string> = {
  Router: "Maršrutizatorius",
  Switch: "Komutatorius",
  AccessPoint: "Prieigos taškas",
  Firewall: "Ugniasienė",
  Other: "Kitas įrenginys",
};
export const clientTypes: Record<string, string> = {
  Computer: "Kompiuteris",
  Phone: "Telefonas",
  Tablet: "Planšetė",
  Printer: "Spausdintuvas",
  Other: "Kitas klientas",
};
export const statuses: Record<string, string> = {
  Online: "Aktyvus",
  Offline: "Neaktyvus",
  Maintenance: "Priežiūra",
};
export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("lt-LT", { dateStyle: "medium" }).format(
    new Date(value),
  );
