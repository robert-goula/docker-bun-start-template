import { useMemo, useRef } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { type UpdateUserInput, type UserId } from "@/db/schema/users";
import { Button } from "@/components/ui/button";
import { Field, FieldBody, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { idParam } from "@/lib/shortId";
import { usersRepo } from "@/repositories/users";

export const Route = createFileRoute("/{-$locale}/_authed/admin/users/$userId")({
  params: idParam("userId"),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(usersRepo.byId(params.userId as UserId)),
  component: RouteComponent,
});

type FormValues = {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string;
};

// Build a patch containing only the fields whose form value differs from the
// baseline — this is what gets sent to the server.
function diffPatch(baseline: FormValues, current: FormValues): UpdateUserInput {
  const patch: UpdateUserInput = {};
  if (current.username !== baseline.username) patch.username = current.username.trim();
  if (current.email !== baseline.email) patch.email = current.email.trim();
  if (current.firstName !== baseline.firstName) patch.firstName = current.firstName.trim() || null;
  if (current.lastName !== baseline.lastName) patch.lastName = current.lastName.trim() || null;
  if (current.roles !== baseline.roles)
    patch.roles = current.roles
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
  return patch;
}

const errorMessages = (errors: unknown[]) =>
  errors.flatMap((e) => (typeof e === "string" ? [{ message: e }] : []));

const fieldLabels: Record<keyof UpdateUserInput, string> = {
  username: "Username",
  email: "Email",
  firstName: "First name",
  lastName: "Last name",
  roles: "Roles",
};

// Render the saved patch as "Label: new value" lines for the success toast.
function describeChanges(patch: UpdateUserInput) {
  return (Object.keys(patch) as (keyof UpdateUserInput)[]).map((key) => {
    const value = patch[key];
    const display =
      value == null || value === "" ? "cleared" : Array.isArray(value) ? value.join(", ") : value;
    return (
      <div key={key}>
        <strong>{fieldLabels[key]}:</strong> {display}
      </div>
    );
  });
}

function RouteComponent() {
  const { userId } = Route.useParams();
  const id = userId as UserId;
  const qc = useQueryClient();
  const { data: user } = useSuspenseQuery(usersRepo.byId(id));

  const initial = useMemo<FormValues>(
    () => ({
      username: user.username,
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      email: user.email,
      roles: user.roles.join(", "),
    }),
    [user],
  );

  // Baseline the dirty-field diff is measured against; advanced after each save
  // so subsequent edits only resend what changed since the last successful PATCH.
  const baselineRef = useRef(initial);

  const updateMutation = useMutation(usersRepo.update(qc));

  const form = useForm({
    defaultValues: initial,
    onSubmit: async ({ value, formApi }) => {
      const patch = diffPatch(baselineRef.current, value);
      if (Object.keys(patch).length === 0) return;
      try {
        await updateMutation.mutateAsync({ id, patch });
        baselineRef.current = value;
        formApi.reset(value);
        const count = Object.keys(patch).length;
        toast.success(`${value.username} updated`, {
          description: (
            <div>
              <div>
                {count} {count === 1 ? "field" : "fields"} changed
              </div>
              {describeChanges(patch)}
            </div>
          ),
        });
      } catch (err) {
        toast.error("Couldn’t update user", {
          description: err instanceof Error ? err.message : "Please try again.",
        });
      }
    },
  });

  return (
    <>
      <section className="full">
        <Link to="/{-$locale}/admin/users">← Back to users</Link>
        <h1>Edit {user.username}</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          className={"form"}
        >
          <FieldGroup>
            <form.Field
              name="username"
              validators={{
                onChange: ({ value }) => (!value.trim() ? "Username is required" : undefined),
              }}
            >
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                  <FieldBody>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                    <FieldError errors={errorMessages(field.state.meta.errors)} />
                  </FieldBody>
                </Field>
              )}
            </form.Field>

            <form.Field
              name="email"
              validators={{
                onChange: ({ value }) => {
                  if (!value.trim()) return "Email is required";
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email";
                },
              }}
            >
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                  <FieldBody>
                    <Input
                      id={field.name}
                      type="email"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                    <FieldError errors={errorMessages(field.state.meta.errors)} />
                  </FieldBody>
                </Field>
              )}
            </form.Field>

            <form.Field name="firstName">
              {(field) => (
                <Field className={"½"}>
                  <FieldLabel htmlFor={field.name}>First name</FieldLabel>
                  <FieldBody>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  </FieldBody>
                </Field>
              )}
            </form.Field>

            <form.Field name="lastName">
              {(field) => (
                <Field className={"½"}>
                  <FieldLabel htmlFor={field.name}>Last name</FieldLabel>
                  <FieldBody>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  </FieldBody>
                </Field>
              )}
            </form.Field>

            <form.Field name="roles">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Roles</FieldLabel>
                  <FieldBody>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      placeholder="admin, user"
                    />
                  </FieldBody>
                </Field>
              )}
            </form.Field>

            <form.Subscribe selector={(s) => s.values}>
              {(values) => {
                const changed = Object.keys(diffPatch(baselineRef.current, values)).length > 0;
                return (
                  <Button
                    type="submit"
                    intent="primary"
                    disabled={!changed || updateMutation.isPending}
                  >
                    {updateMutation.isPending ? "Saving…" : "Save changes"}
                  </Button>
                );
              }}
            </form.Subscribe>
          </FieldGroup>
        </form>
      </section>
    </>
  );
}
