import { type Mock } from "vitest";

export interface ApiOpts {
  method?: string;
  body?: unknown;
  query?: Record<string, unknown>;
  file?: string;
}

type Res = unknown | ((opts: ApiOpts, path: string) => unknown);

export interface Route {
  path: RegExp | string;
  method?: string;
  res: Res;
}

/** Drive a mocked `ntnApi` by routing (path, method) → response. */
export function routeNtn(api: Mock, routes: Route[]): void {
  api.mockImplementation(async (path: string, opts: ApiOpts = {}) => {
    const method = (opts.method ?? "GET").toUpperCase();
    for (const r of routes) {
      const pathOk =
        r.path instanceof RegExp ? r.path.test(path) : path === r.path;
      const methodOk = !r.method || r.method.toUpperCase() === method;
      if (pathOk && methodOk) {
        return typeof r.res === "function"
          ? (r.res as (o: ApiOpts, p: string) => unknown)(opts, path)
          : r.res;
      }
    }
    throw new Error(`unmocked ntn call: ${method} ${path}`);
  });
}

/** Find the recorded `ntnApi` call matching a path (and optional method). */
export function apiCall(
  api: Mock,
  path: RegExp | string,
  method?: string,
): [string, ApiOpts] | undefined {
  return api.mock.calls.find((call: [string, ApiOpts?]) => {
    const [p, o = {}] = call;
    const pathOk = path instanceof RegExp ? path.test(p) : p === path;
    const methodOk =
      !method || (o.method ?? "GET").toUpperCase() === method.toUpperCase();
    return pathOk && methodOk;
  }) as [string, ApiOpts] | undefined;
}
