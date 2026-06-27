import { useMemo, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/db/schema/pages";
import { type TaxonomyId, type UpdateTaxonomyInput } from "@/db/schema/taxonomy";
import { Button } from "@/components/ui/button";
import { Field, FieldBody, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { encodeId, idParam } from "@/lib/shortId";
import { taxonomyRepo } from "@/repositories/taxonomy";

export const Route = createFileRoute("/{-$locale}/_authed/admin/taxonomy/$taxonomyId")({
  params: idParam("taxonomyId"),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(taxonomyRepo.byId(params.taxonomyId as TaxonomyId)),
  component: RouteComponent,
});

type LocaleLabels = Record<Locale, string>;

// Initialize one label input per supported locale from the stored `locales` map (default "").
function toLabels(locales: Record<string, string>): LocaleLabels {
  return LOCALES.reduce((acc, locale) => {
    acc[locale] = locales[locale] ?? "";
    return acc;
  }, {} as LocaleLabels);
}

// Rebuild the `locales` jsonb from the per-locale inputs, dropping blanks. Clearing a locale's
// input removes that translation; the form shows every locale, so this never loses data.
function toLocales(labels: LocaleLabels): Record<string, string> {
  const out: Record<string, string> = {};
  for (const locale of LOCALES) {
    const trimmed = labels[locale].trim();
    if (trimmed) out[locale] = trimmed;
  }
  return out;
}

function sameLabels(a: LocaleLabels, b: LocaleLabels): boolean {
  return LOCALES.every((locale) => a[locale].trim() === b[locale].trim());
}

function RouteComponent() {
  const { taxonomyId } = Route.useParams();
  const id = taxonomyId as TaxonomyId;
  const qc = useQueryClient();
  const { data: taxonomy } = useSuspenseQuery(taxonomyRepo.byId(id));

  const initial = useMemo(
    () => ({
      value: taxonomy.value,
      sort: String(taxonomy.sort),
      labels: toLabels(taxonomy.locales ?? {}),
    }),
    [taxonomy],
  );

  const [value, setValue] = useState(initial.value);
  const [sort, setSort] = useState(initial.sort);
  const [labels, setLabels] = useState<LocaleLabels>(initial.labels);

  const updateMutation = useMutation(taxonomyRepo.update(qc));

  const changed =
    value.trim() !== initial.value ||
    sort.trim() !== initial.sort ||
    !sameLabels(labels, initial.labels);

  // Keep the list's `parent` search param as base58, matching the path-param id convention.
  const backSearch = { parent: taxonomy.parentId ? encodeId(taxonomy.parentId) : undefined };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedValue = value.trim();
    if (!trimmedValue || !changed) return;

    const patch: UpdateTaxonomyInput = {
      value: trimmedValue,
      sort: Number.parseInt(sort, 10) || 0,
      locales: toLocales(labels),
    };
    try {
      const updated = await updateMutation.mutateAsync({ id, patch });
      // Re-baseline so the form is clean after a successful save.
      setValue(updated.value);
      setSort(String(updated.sort));
      setLabels(toLabels(updated.locales ?? {}));
      toast.success(`Saved "${updated.locales?.[DEFAULT_LOCALE] ?? updated.value}"`);
    } catch (err) {
      toast.error("Couldn’t save taxonomy", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  }

  return (
    <section className="full">
      <Link to="/{-$locale}/admin/taxonomy" search={backSearch}>
        ← Back to list
      </Link>
      <h1>Edit taxonomy</h1>

      <form onSubmit={handleSubmit} className="form">
        <FieldGroup>
          <Field className="½">
            <FieldLabel htmlFor="taxonomy-value">Value (canonical)</FieldLabel>
            <FieldBody>
              <Input
                id="taxonomy-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="#ff0000"
              />
            </FieldBody>
          </Field>

          <Field className="½">
            <FieldLabel htmlFor="taxonomy-sort">Sort</FieldLabel>
            <FieldBody>
              <Input
                id="taxonomy-sort"
                type="number"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              />
            </FieldBody>
          </Field>

          {/* One label input per locale — this is where additional translations are added. */}
          {LOCALES.map((locale) => (
            <Field key={locale} className="½">
              <FieldLabel htmlFor={`taxonomy-label-${locale}`}>
                Label ({locale}){locale === DEFAULT_LOCALE ? " — default" : ""}
              </FieldLabel>
              <FieldBody>
                <Input
                  id={`taxonomy-label-${locale}`}
                  value={labels[locale]}
                  onChange={(e) => setLabels((prev) => ({ ...prev, [locale]: e.target.value }))}
                  placeholder={locale === DEFAULT_LOCALE ? "Red" : "translation"}
                />
              </FieldBody>
            </Field>
          ))}

          <Button
            type="submit"
            intent="primary"
            disabled={!value.trim() || !changed || updateMutation.isPending}
          >
            {updateMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </FieldGroup>
      </form>
    </section>
  );
}
