export function normalizeRouteSegment(value: string): string {
  return value.replace(/^\/+/, "").replace(/\/+$/, "");
}

export function buildRoutePath(baseEndpoint: string, adapterPath: string): string {
  return `/${normalizeRouteSegment(baseEndpoint)}/${normalizeRouteSegment(adapterPath)}`;
}
