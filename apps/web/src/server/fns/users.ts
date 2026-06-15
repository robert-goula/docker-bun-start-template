import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import * as z from "zod";
import {
  ListUsersInput,
  selectUserSchema,
  updateUserSchema,
  type ListUsersPagedMeta,
  type PageSize,
  type UserId,
} from "@/db/schema/users";
import { authMiddleware } from "@/server/fns/auth";
import { runtime } from "@/server/runtime";
import { CurrentUser } from "@/server/services/CurrentUser";
import { UserRepo } from "@/server/services/UserRepo";

const UserIdInput = z.object({ id: z.uuid() });

const CreateUserInput = z.object({
  username: z.string().min(1).max(40),
  email: z.email().max(255),
  password: z.string().min(8).max(255),
});

const UpdateUserArgs = z.object({ id: z.uuid(), patch: updateUserSchema });

const forbidden = () => Effect.fail(new Response("Forbidden", { status: 403 }));
const notFound = () => Effect.fail(new Response("Not Found", { status: 404 }));
const dbError = () => Effect.fail(new Response("Internal Server Error", { status: 500 }));

export const getUserByIdFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => UserIdInput.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* UserRepo;
        const user = yield* repo.findById(data.id as UserId);
        return selectUserSchema.parse(user);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({
          UserNotFound: notFound,
          Forbidden: forbidden,
          DatabaseError: dbError,
        }),
      ),
    ),
  );

export const listUsersFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => ListUsersInput.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* UserRepo;
        const { rows, totalCount } = yield* repo.list(data);
        const pageCount = Math.ceil(totalCount / data.pageSize);
        const meta: ListUsersPagedMeta = {
          totalCount,
          pageCount,
          pageNumber: data.pageNumber,
          pageSize: data.pageSize as PageSize,
        };
        return { data: rows.map((row) => selectUserSchema.parse(row)), meta };
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({
          Forbidden: forbidden,
          DatabaseError: dbError,
        }),
      ),
    ),
  );

export const updateUserFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => UpdateUserArgs.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* UserRepo;
        const updated = yield* repo.update(data.id as UserId, data.patch);
        return selectUserSchema.parse(updated);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({
          UserNotFound: notFound,
          Forbidden: forbidden,
          DatabaseError: dbError,
        }),
      ),
    ),
  );

export const createUserFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CreateUserInput.parse(input))
  .middleware([authMiddleware])
  .handler(({ data, context }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const repo = yield* UserRepo;
        const created = yield* repo.create(data);
        return selectUserSchema.parse(created);
      }).pipe(
        Effect.provideService(CurrentUser, context.user),
        Effect.catchTags({
          Forbidden: forbidden,
          DatabaseError: dbError,
        }),
      ),
    ),
  );
