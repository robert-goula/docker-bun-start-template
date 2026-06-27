import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useIntlayer } from "react-intlayer";
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
import AdminCmsPage from "@/components/AdminCmsPage";
import { loadAdminPage } from "@/lib/loadPage";
import { buildHref, DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/locale";
import { pagesKeys, pagesRepo } from "@/repositories/pages";
import { createPageFn, createPageTranslationFn, type SafePageListItem } from "@/server/fns/pages";

const PAGE_SLUG = "/admin/pages";

export const Route = createFileRoute("/{-$locale}/_authed/admin/pages/")({
  loader: async ({ context }) => {
    const ref = { slug: PAGE_SLUG, locale: context.i18n.locale };
    const [layout] = await Promise.all([
      loadAdminPage(context.queryClient, ref),
      context.queryClient.ensureQueryData(pagesRepo.list()),
    ]);
    return { layout, ref };
  },
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
  const { layout, ref } = Route.useLoaderData();
  return (
    <AdminCmsPage pageRef={ref} layout={layout}>
      <PagesList />
    </AdminCmsPage>
  );
}

function PagesList() {
  const content = useIntlayer("adminPages");
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
    <>
      <section className="full">
        <h1>{content.title}</h1>

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
            <span className="text-xs">{content.slugLabel}</span>
            <Input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="/about"
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span className="text-xs">{content.localeLabel}</span>
            <select value={newLocale} onChange={(e) => setNewLocale(e.target.value as Locale)}>
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span className="text-xs">{content.titleLabel}</span>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="About"
            />
          </label>
          <Button type="submit" size="sm" disabled={createPage.isPending || !newSlug.trim()}>
            {createPage.isPending ? content.creating : content.newPage}
          </Button>
        </form>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{content.slugLabel}</TableHead>
              <TableHead>{content.colTitle}</TableHead>
              {LOCALES.map((l) => (
                <TableHead key={l}>{l}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2 + LOCALES.length}>{content.noPages}</TableCell>
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
                              aria-label={`${content.view.value} ${slug} (${locale})`}
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
                            {content.add}
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
    </>
  );
}
