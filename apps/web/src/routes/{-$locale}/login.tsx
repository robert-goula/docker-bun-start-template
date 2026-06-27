import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useIntlayer } from "react-intlayer";
import * as z from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldBody, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginFn } from "@/server/fns/auth";

const SearchSchema = z.object({
  next: z.string().optional(),
});

export const Route = createFileRoute("/{-$locale}/login")({
  validateSearch: SearchSchema,
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const content = useIntlayer("login");
  const { next } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: async (vars: { email: string; password: string }) => {
      const result = await loginFn({ data: vars });
      if (!result.ok) throw new Error(result.error);
      return result.user;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      router.navigate({ to: next ?? "/" });
    },
  });

  return (
    <main>
      <Card className={"½"}>
        <CardHeader>
          <CardTitle>{content.title}</CardTitle>
          <CardDescription>{content.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate({ email, password });
            }}
          >
            <FieldGroup>
              {mutation.isError && (
                <Alert intent="danger">
                  <AlertTitle>{content.errorTitle}</AlertTitle>
                  <AlertDescription>
                    {mutation.error instanceof Error
                      ? mutation.error.message
                      : content.errorFallback}
                  </AlertDescription>
                </Alert>
              )}
              <Field>
                <FieldLabel htmlFor="email">{content.emailLabel}</FieldLabel>
                <FieldBody>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={content.emailPlaceholder.value}
                  />
                </FieldBody>
              </Field>
              <Field>
                <FieldLabel htmlFor="password">{content.passwordLabel}</FieldLabel>
                <FieldBody>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </FieldBody>
              </Field>
              <Button type="submit" intent="primary" disabled={mutation.isPending}>
                {mutation.isPending ? content.submitting : content.submit}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
