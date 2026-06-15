import { Menu } from "@base-ui/react/menu";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  accentQueryOptions,
  setAccentFn,
  ACCENTS,
  DEFAULT_ACCENT,
  type Accent,
} from "@/server/fns/accent";
import { buttonVariants } from "@/components/ui/button";
import styles from "./AccentControls.module.css";

function applyAccentToDocument(accent: Accent) {
  document.documentElement.setAttribute("data-accent", accent);
}

export default function AccentControls() {
  const qc = useQueryClient();
  const { data: accent } = useQuery(accentQueryOptions());
  const current = accent ?? DEFAULT_ACCENT;

  const mutation = useMutation({
    mutationFn: (next: Accent) => setAccentFn({ data: { accent: next } }),
    onSuccess: (next) => {
      qc.setQueryData(accentQueryOptions().queryKey, next);
      applyAccentToDocument(next);
    },
  });

  return (
    <Menu.Root>
      <Menu.Trigger
        className={buttonVariants({ size: "xs" })}
        aria-label="Accent colour"
        disabled={mutation.isPending}
      >
        <span className={styles.triggerSwatch} data-accent={current} />
        <svg className={styles.chevron} viewBox="0 0 10 6" fill="none" aria-hidden="true">
          <path
            d="M1 1l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4} align="start">
          <Menu.Popup className={styles.popup}>
            {ACCENTS.map((option) => {
              const selected = option.value === current;
              return (
                <Menu.Item
                  key={option.value}
                  className={styles.item}
                  onClick={() => mutation.mutate(option.value)}
                >
                  <span className={styles.itemSwatch} data-accent={option.value} />
                  <span className={selected ? styles.itemLabelSelected : styles.itemLabel}>
                    {option.label}
                  </span>
                  {selected && (
                    <svg
                      className={styles.itemCheck}
                      viewBox="0 0 10 8"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M1 4l3 3 5-6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </Menu.Item>
              );
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
