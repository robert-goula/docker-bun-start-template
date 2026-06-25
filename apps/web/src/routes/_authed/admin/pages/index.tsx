import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildHref, DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/locale";
import { pagesKeys, pagesRepo } from "@/repositories/pages";
import { createPageFn, createPageTranslationFn, type SafePageListItem } from "@/server/fns/pages";

export const Route = createFileRoute("/_authed/admin/pages/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(pagesRepo.list()),
  component: RouteComponent,
});

// A slug and its localized rows. Grouping by slug (the shared content key) makes
// translation coverage obvious: a locale missing from `byLocale` has no translation yet.
interface PageGroup {
  slug: string;
  byLocale: Map<Locale, SafePageListItem>;
}

function groupBySlug(items: ReadonlyArray<SafePageListItem>): PageGroup[] {
  const map = new Map<string, Map<Locale, SafePageListItem>>();
  for (const item of items) {
    let byLocale = map.get(item.slug);
    if (!byLocale) {
      byLocale = new Map();
      map.set(item.slug, byLocale);
    }
    byLocale.set(item.locale, item);
  }
  return [...map.entries()].map(([slug, byLocale]) => ({ slug, byLocale }));
}

function RouteComponent() {
  const { data = [] } = useQuery(pagesRepo.list());
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: pagesKeys.list() });

  const groups = useMemo(() => groupBySlug(data), [data]);

  const addTranslation = useMutation({
    mutationFn: (input: { slug: string; fromLocale: Locale; toLocale: Locale }) =>
      createPageTranslationFn({ data: input }),
    onSuccess: invalidate,
  });

  const createPage = useMutation({
    mutationFn: (input: { slug: string; locale: Locale; title?: string }) =>
      createPageFn({ data: input }),
    onSuccess: invalidate,
  });

  const [newSlug, setNewSlug] = useState("");
  const [newLocale, setNewLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [newTitle, setNewTitle] = useState("");

  const submitNewPage = (e: React.FormEvent) => {
    e.preventDefault();
    const slug = newSlug.trim();
    if (!slug) return;
    createPage.mutate(
      {
        slug: slug.startsWith("/") ? slug : `/${slug}`,
        locale: newLocale,
        title: newTitle.trim() || undefined,
      },
      {
        onSuccess: () => {
          setNewSlug("");
          setNewTitle("");
        },
      },
    );
  };

  return (
    <main className="zone">
      <section className="full">
        <h1>Pages</h1>

        <form
          onSubmit={submitNewPage}
          style={{
            display: "flex",
            gap: "var(--spacing-sm)",
            alignItems: "end",
            marginBottom: "var(--spacing-md)",
            flexWrap: "wrap",
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span className="text-xs">Slug</span>
            <Input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="/about"
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span className="text-xs">Locale</span>
            <select value={newLocale} onChange={(e) => setNewLocale(e.target.value as Locale)}>
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span className="text-xs">Title (optional)</span>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="About"
            />
          </label>
          <Button type="submit" size="sm" disabled={createPage.isPending || !newSlug.trim()}>
            {createPage.isPending ? "Creating…" : "+ New page"}
          </Button>
        </form>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Slug</TableHead>
              <TableHead>Title</TableHead>
              {LOCALES.map((l) => (
                <TableHead key={l}>{l}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2 + LOCALES.length}>No pages yet.</TableCell>
              </TableRow>
            ) : (
              groups.map(({ slug, byLocale }) => {
                // Clone from the default locale when present, otherwise any existing locale.
                const source = byLocale.get(DEFAULT_LOCALE) ?? [...byLocale.values()][0];
                const title = source?.title ?? slug;
                return (
                  <TableRow key={slug}>
                    <TableCell>
                      <code>{slug}</code>
                    </TableCell>
                    <TableCell>{title}</TableCell>
                    {LOCALES.map((locale) => {
                      const item = byLocale.get(locale);
                      if (item) {
                        return (
                          <TableCell key={locale}>
                            <a
                              href={buildHref(locale, slug)}
                              aria-label={`View ${slug} (${locale})`}
                            >
                              ✔
                            </a>
                          </TableCell>
                        );
                      }
                      return (
                        <TableCell key={locale}>
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={!source || addTranslation.isPending}
                            onClick={() =>
                              source &&
                              addTranslation.mutate({
                                slug,
                                fromLocale: source.locale,
                                toLocale: locale,
                              })
                            }
                          >
                            + Add
                          </Button>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </section>
    </main>
  );
}
