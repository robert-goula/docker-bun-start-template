import { notFound } from "@tanstack/react-router";
import { createTranslator } from "short-uuid";

// Single base58 translator (flickrBase58 alphabet) shared across the app.
// IDs are stored and used everywhere as uuid v7; this module is the *only* place
// they are converted to/from the ~22-char base58 form that appears in browser
// URLs. The REST API, server fns, repos, and DB always speak full uuid.
const translator = createTranslator();

/** uuid v7 → base58 (~22 chars) for display in the browser URL. */
export function encodeId(uuid: string): string {
  return translator.fromUUID(uuid);
}

/** base58 → lowercase canonical uuid. Throws if the input is not valid base58. */
export function decodeId(value: string): string {
  return translator.toUUID(value);
}

/**
 * base58 → uuid for an *optional* id-valued search/filter param: returns `undefined` when the
 * value is absent or not decodable, rather than throwing. Use at the boundary of an id-bearing
 * query param (e.g. `?parent=`, `?filter[author]=`) so the URL stays base58 while the app keeps
 * the raw uuid. Pair with `encodeId` when writing the param onto a `<Link>` / `navigate`.
 */
export function decodeIdParam(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return decodeId(value);
  } catch {
    return undefined;
  }
}

/**
 * Route `params` config that keeps the URL as base58 while the app keeps the real
 * uuid. Add to an id route: `params: idParam("userId")`.
 *
 * Params stay typed as plain `string` (TanStack derives the navigation param type
 * from `parse`'s return), so `<Link>` / `navigate` keep passing `row.original.id`
 * unchanged; loaders/components cast to the branded `<Entity>Id` as before. A
 * malformed id 404s rather than crashing the route match.
 */
export function idParam<K extends string>(key: K) {
  return {
    parse: (raw: Record<K, string>): Record<K, string> => {
      try {
        return { [key]: decodeId(raw[key]) } as Record<K, string>;
      } catch {
        throw notFound();
      }
    },
    stringify: (params: Record<K, string>): Record<K, string> =>
      ({ [key]: encodeId(params[key]) }) as Record<K, string>,
  };
}
