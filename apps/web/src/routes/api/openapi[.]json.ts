import { createFileRoute } from "@tanstack/react-router";
import { buildOpenApiDocument } from "@/lib/openapi/spec";

export const Route = createFileRoute("/api/openapi.json")({
  server: {
    handlers: {
      GET: () =>
        Response.json(buildOpenApiDocument(), {
          headers: {
            "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
          },
        }),
    },
  },
});
