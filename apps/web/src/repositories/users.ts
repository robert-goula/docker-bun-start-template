import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type * as z from "zod";
import {
  selectUserSchema,
  type ListUsersPagedMeta,
  type ListUsersParams,
  type UpdateUserInput,
  type UserId,
} from "@/db/schema/users";
import { createUserFn, getUserByIdFn, listUsersFn } from "@/server/fns/users";

export type SafeUser = z.infer<typeof selectUserSchema>;
export type { ListUsersPagedMeta };

const JSON_API = "application/vnd.api+json";

// Sends only the changed fields as a JSON:API PATCH to the users endpoint, which
// in turn calls the updateUserFn server function to apply the patch via the repo.
async function patchUser(id: UserId, patch: UpdateUserInput): Promise<SafeUser> {
  const res = await fetch(`/api/users/${id}`, {
    method: "PATCH",
    headers: { "content-type": JSON_API, accept: JSON_API },
    body: JSON.stringify({ data: { type: "user", id, attributes: patch } }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = json?.errors?.[0]?.detail ?? json?.errors?.[0]?.title;
    throw new Error(detail ?? `Failed to update user (${res.status})`);
  }
  return json.data.attributes as SafeUser;
}

export const usersKeys = {
  all: ["users"] as const,
  list: (params?: ListUsersParams) => [...usersKeys.all, "list", params ?? {}] as const,
  byId: (id: UserId) => [...usersKeys.all, "byId", id] as const,
};

export const usersRepo = {
  byId: (id: UserId) =>
    queryOptions({
      queryKey: usersKeys.byId(id),
      queryFn: ({ signal }) => getUserByIdFn({ data: { id }, signal }),
    }),

  list: (params: ListUsersParams) =>
    queryOptions({
      queryKey: usersKeys.list(params),
      queryFn: ({ signal }) => listUsersFn({ data: params, signal }),
    }),

  create: (qc: QueryClient) =>
    mutationOptions({
      mutationFn: (input: { username: string; email: string; password: string }) =>
        createUserFn({ data: input }),
      onSuccess: () => qc.invalidateQueries({ queryKey: usersKeys.all }),
    }),

  update: (qc: QueryClient) =>
    mutationOptions({
      mutationFn: ({ id, patch }: { id: UserId; patch: UpdateUserInput }) => patchUser(id, patch),
      onSuccess: (_user, { id }) => {
        qc.invalidateQueries({ queryKey: usersKeys.byId(id) });
        qc.invalidateQueries({ queryKey: usersKeys.all });
      },
    }),
};
