export interface JsonApiResource<T> {
  type: string;
  id: string;
  attributes: T;
  links?: Record<string, string>;
}

export interface JsonApiSingle<T> {
  data: JsonApiResource<T>;
  links?: Record<string, string>;
}

export interface JsonApiCollection<T> {
  data: ReadonlyArray<JsonApiResource<T>>;
  meta?: Record<string, unknown>;
  links?: Record<string, string>;
}

export interface JsonApiError {
  status: string;
  title: string;
  detail?: string;
  source?: { pointer?: string; parameter?: string };
}

export function jsonApiResource<T>(opts: {
  type: string;
  id: string;
  attributes: T;
  links?: Record<string, string>;
}): JsonApiSingle<T> {
  return {
    data: {
      type: opts.type,
      id: opts.id,
      attributes: opts.attributes,
      ...(opts.links ? { links: opts.links } : {}),
    },
  };
}

export function jsonApiCollection<T>(opts: {
  data: ReadonlyArray<{
    type: string;
    id: string;
    attributes: T;
    links?: Record<string, string>;
  }>;
  links?: Record<string, string>;
}): JsonApiCollection<T> {
  return {
    data: opts.data.map((r) => ({
      type: r.type,
      id: r.id,
      attributes: r.attributes,
      ...(r.links ? { links: r.links } : {}),
    })),
    ...(opts.links ? { links: opts.links } : {}),
  };
}

const contentTypes = {
  json: "application/json",
  jsonapi: "application/vnd.api+json",
} as const;

export function negotiate<TJson = unknown, TJsonApi = unknown>(
  request: Request,
  json: { data: TJson },
  jsonapi: JsonApiSingle<TJsonApi> | JsonApiCollection<TJsonApi>,
  init?: ResponseInit,
): Response {
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes(contentTypes.jsonapi)) {
    return new Response(JSON.stringify(jsonapi), {
      ...init,
      headers: { ...init?.headers, "content-type": contentTypes.jsonapi },
    });
  }
  return new Response(JSON.stringify(json), {
    ...init,
    headers: { ...init?.headers, "content-type": contentTypes.json },
  });
}

export function negotiateError(
  request: Request,
  opts: { status: number; title: string; detail?: string },
): Response {
  const accept = request.headers.get("accept") ?? "";
  const wantsJsonApi = accept.includes(contentTypes.jsonapi);
  const error: JsonApiError = {
    status: String(opts.status),
    title: opts.title,
    ...(opts.detail !== undefined ? { detail: opts.detail } : {}),
  };
  const body = wantsJsonApi
    ? JSON.stringify({ errors: [error] })
    : JSON.stringify({
        error: opts.title,
        ...(opts.detail !== undefined ? { detail: opts.detail } : {}),
      });
  return new Response(body, {
    status: opts.status,
    headers: { "content-type": wantsJsonApi ? contentTypes.jsonapi : contentTypes.json },
  });
}
