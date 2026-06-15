import type { CreateUser } from "@/db/schema/users";

export const users: Array<CreateUser> = [
  {
    id: "0194c20f-e9f0-7445-8ab4-4415d5935ca7",
    username: "admin",
    password:
      "$argon2id$v=19$m=19456,t=3,p=1$sC6hBUNIB6vLzRczcPnYCafV9eCNP2eFxYMbJepFyUs$VrmFL55qCzdkuPJIs3dEAAWZpYH0GN6sFpPlx+y4uMg",
    firstName: "Admin",
    lastName: "User",
    email: "admin@example.com",
    roles: ["user", "admin"],
    created: new Date("2021-09-01T00:00:00.000Z"),
    createdBy: "00000000-0000-0000-0000-000000000000",
    updated: new Date("2026-06-16T19:00:32.283Z"),
    updatedBy: null,
    locked: true,
    lockedBy: "00000000-0000-0000-0000-000000000000",
    passwordRehashedAt: null,
  },
];
