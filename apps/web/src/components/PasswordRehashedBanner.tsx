import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { acknowledgePasswordRehashFn, meQueryOptions } from "@/server/fns/auth";
import { Button } from "@/components/ui/button";

export default function PasswordRehashedBanner() {
  const me = useSuspenseQuery(meQueryOptions());
  const qc = useQueryClient();
  const ack = useMutation({
    mutationFn: () => acknowledgePasswordRehashFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });

  if (!me.data?.passwordRehashedAt) return null;

  return (
    <div role="status" className="flex items-center gap-3 border-b bg-muted px-4 py-2 text-sm">
      <span className="flex-1">
        We upgraded the security of your stored password. No action needed.
      </span>
      <Button size="sm" variant="outline" disabled={ack.isPending} onClick={() => ack.mutate()}>
        {ack.isPending ? "Dismissing…" : "Dismiss"}
      </Button>
    </div>
  );
}
