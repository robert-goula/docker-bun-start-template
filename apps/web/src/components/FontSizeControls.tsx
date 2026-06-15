import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { adjustSizeFn, sizeQueryOptions, SIZES, DEFAULT_SIZE, type Size } from "@/server/fns/size";
import { FontDecreaseIcon, FontIncreaseIcon } from "@/components/icons";
import styles from "./FontSizeControls.module.css";
import {useId} from "react";

function applySizeToDocument(size: Size) {
  document.documentElement.setAttribute("data-size", size);
}

export default function FontSizeControls() {
  const qc = useQueryClient();
  const { data: size } = useQuery(sizeQueryOptions());
  const current = size ?? DEFAULT_SIZE;
  const currentIndex = SIZES.indexOf(current);

  const adjust = useMutation({
    mutationFn: (direction: "+" | "-") => adjustSizeFn({ data: { direction } }),
    onSuccess: (nextSize) => {
      qc.setQueryData(sizeQueryOptions().queryKey, nextSize);
      applySizeToDocument(nextSize);
    },
  });

  const fsDown = useId();
  const fsUp = useId();
  return (
    <>
      <Button
        size="xs"
        type="button"
        variant="default"
        aria-labelledby={fsDown}
        disabled={currentIndex <= 0 || adjust.isPending}
        onClick={() => adjust.mutate("-")}
        className={styles.fontSizeControls}
      >
        <FontDecreaseIcon />
        <span
          id={fsDown}
          className="sr-only"
        >
          Decrease font size
        </span>
      </Button>
      <Button
        id={fsDown}
        size="xs"
        type="button"
        variant="default"
        aria-labelledby={fsUp}
        disabled={currentIndex >= SIZES.length - 1 || adjust.isPending}
        onClick={() => adjust.mutate("+")}
        className={styles.fontSizeControls}
      >
        <FontIncreaseIcon />
        <span
          id={fsDown}
          className="sr-only"
        >
          Increase font size
        </span>
      </Button>
    </>
  );
}
