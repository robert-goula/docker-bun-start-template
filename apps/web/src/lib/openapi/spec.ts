import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import * as z from "zod";
import { registry } from "./registry";
import { selectUserSchema } from "@/db/schema/users";

const UserSchema = registry.register("User", selectUserSchema);

const UserCreateSchema = registry.register(
  "UserCreate",
  z.object({
    username: z.string().max(40),
    password: z.string().min(8),
    firstName: z.string().max(20).nullable().optional(),
    lastName: z.string().max(20).nullable().optional(),
    email: z.string().email().max(255),
    roles: z.array(z.string()).optional(),
  }),
);

const ErrorSchema = registry.register(
  "Error",
  z.object({
    error: z.string(),
    detail: z.string().optional(),
  }),
);

const JsonApiErrorSchema = registry.register(
  "JsonApiError",
  z.object({
    errors: z.array(
      z.object({
        status: z.string(),
        title: z.string(),
        detail: z.string().optional(),
      }),
    ),
  }),
);

let cachedDocument: object | null = null;

function registerComponents() {
  registry.registerComponent("securitySchemes", "cookieAuth", {
    type: "apiKey",
    in: "cookie",
    name: "session",
    description: "Session cookie. Call POST /api/auth/sessions to obtain one.",
  });
}

function registerPaths() {
  // ── POST /api/auth/sessions ───────────────────────────────────────────────
  const LoginSchema = registry.register(
    "Login",
    z.object({
      email: z.string().email().max(255),
      password: z.string().min(1).max(255),
    }),
  );

  const SessionUserSchema = registry.register(
    "SessionUser",
    z.object({
      id: z.string().uuid(),
      email: z.string().email(),
      roles: z.array(z.string()),
      passwordRehashedAt: z.string().datetime().nullable(),
    }),
  );

  registry.registerPath({
    method: "post",
    path: "/api/auth/sessions",
    summary: "Log in — creates a session cookie",
    tags: ["Auth"],
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: LoginSchema } },
      },
    },
    responses: {
      201: {
        description: "Session created. The session cookie is set via Set-Cookie.",
        content: {
          "application/json": {
            schema: z.object({ data: z.object({ user: SessionUserSchema }) }),
          },
        },
      },
      401: {
        description: "Invalid credentials",
        content: { "application/json": { schema: ErrorSchema } },
      },
      422: {
        description: "Validation error",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  // ── DELETE /api/auth/sessions ─────────────────────────────────────────────
  registry.registerPath({
    method: "delete",
    path: "/api/auth/sessions",
    summary: "Log out — destroys the session",
    tags: ["Auth"],
    security: [{ cookieAuth: [] }],
    responses: {
      204: { description: "Session destroyed" },
      401: {
        description: "Not authenticated",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  // ── GET /api/users ────────────────────────────────────────────────────────
  registry.registerPath({
    method: "get",
    path: "/api/users",
    summary: "List all users",
    tags: ["Users"],
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: "Array of users",
        content: {
          "application/json": {
            schema: z.array(UserSchema),
          },
          "application/vnd.api+json": {
            schema: z.object({
              data: z.array(
                z.object({ type: z.literal("user"), id: z.string(), attributes: UserSchema }),
              ),
              links: z.object({ self: z.string() }).optional(),
            }),
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: ErrorSchema } },
      },
      403: {
        description: "Forbidden",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  // ── POST /api/users ───────────────────────────────────────────────────────
  registry.registerPath({
    method: "post",
    path: "/api/users",
    summary: "Create a user",
    tags: ["Users"],
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: UserCreateSchema } },
      },
    },
    responses: {
      201: {
        description: "Created user",
        content: { "application/json": { schema: UserSchema } },
      },
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: ErrorSchema } },
      },
      422: {
        description: "Validation error",
        content: {
          "application/json": { schema: ErrorSchema },
          "application/vnd.api+json": { schema: JsonApiErrorSchema },
        },
      },
    },
  });

  // ── GET /api/users/{id} ───────────────────────────────────────────────────
  registry.registerPath({
    method: "get",
    path: "/api/users/{id}",
    summary: "Get a user by ID",
    tags: ["Users"],
    security: [{ cookieAuth: [] }],
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
    responses: {
      200: {
        description: "The user",
        content: {
          "application/json": { schema: UserSchema },
          "application/vnd.api+json": {
            schema: z.object({
              data: z.object({
                type: z.literal("user"),
                id: z.string(),
                attributes: UserSchema,
                links: z.object({ self: z.string() }).optional(),
              }),
            }),
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: { "application/json": { schema: ErrorSchema } },
      },
      403: {
        description: "Forbidden",
        content: { "application/json": { schema: ErrorSchema } },
      },
      404: {
        description: "User not found",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });
}

export function buildOpenApiDocument(): object {
  if (cachedDocument) return cachedDocument;
  registerComponents();
  registerPaths();
  cachedDocument = new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Baseline API",
      version: "1.0.0",
      description: "Auto-generated from Zod schemas derived from the database schema.",
    },
    servers: [
      {
        url: process.env.VITE_HOST_URL ?? "https://docker.localhost",
        description: "Application server",
      },
    ],
  });
  return cachedDocument;
}
