import { type FormEvent, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldBody, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ConfigId } from "@/db/schema/config";
import { configRepo } from "@/repositories/config";

export const Route = createFileRoute("/{-$locale}/_authed/admin/config/$configId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(configRepo.byId(params.configId as ConfigId)),
  component: RouteComponent,
});

function RouteComponent() {
  const { configId } = Route.useParams();
  const id = configId as ConfigId;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: config } = useSuspenseQuery(configRepo.byId(id));

  // Seed local state once from the loader. The value is edited as pretty-printed JSON.
  const [description, setDescription] = useState(config.description ?? "");
  const [valueText, setValueText] = useState(() => JSON.stringify(config.value, null, 2));

  const setMutation = useMutation(configRepo.set(qc));
  const removeMutation = useMutation(configRepo.remove(qc));

  async function handleSave(e: FormEvent) {
    e.preventDefault();

    let value: unknown;
    try {
      value = JSON.parse(valueText);
    } catch {
      toast.error("Value is not valid JSON");
      return;
    }

    try {
      const saved = await setMutation.mutateAsync({
        id,
        value,
        description: description.trim() || null,
      });
      // Re-baseline the editor from the persisted value so formatting matches what's stored.
      setValueText(JSON.stringify(saved.value, null, 2));
      toast.success("Config saved");
    } catch (err) {
      toast.error("Couldn’t save config", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete config "${id}"? This cannot be undone.`)) return;
    try {
      await removeMutation.mutateAsync(id);
      toast.success(`Config "${id}" deleted`);
      navigate({ to: "/{-$locale}/admin/config" });
    } catch (err) {
      toast.error("Couldn’t delete config", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  }

  return (
    <>
      <section className="full">
        <p>
          <Link to="/{-$locale}/admin/config">← Config</Link>
        </p>
        <h1>Edit config</h1>

        <form onSubmit={handleSave} className="form">
          <FieldGroup>
            <Field className="full">
              <FieldLabel htmlFor="config-id">Key</FieldLabel>
              <FieldBody>
                <Input id="config-id" value={id} readOnly disabled />
              </FieldBody>
            </Field>
            <Field className="full">
              <FieldLabel htmlFor="config-description">Description</FieldLabel>
              <FieldBody>
                <Input
                  id="config-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional"
                />
              </FieldBody>
            </Field>
            <Field className="full">
              <FieldLabel htmlFor="config-value">Value (JSON)</FieldLabel>
              <FieldBody>
                <Textarea
                  id="config-value"
                  value={valueText}
                  onChange={(e) => setValueText(e.target.value)}
                  rows={14}
                  spellCheck={false}
                />
              </FieldBody>
            </Field>
            <Button type="submit" intent="primary" disabled={setMutation.isPending}>
              {setMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              intent="danger"
              variant="outline"
              onClick={handleDelete}
              disabled={removeMutation.isPending}
            >
              Delete
            </Button>
          </FieldGroup>
        </form>
      </section>
    </>
  );
}
