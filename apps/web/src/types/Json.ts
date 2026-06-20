import * as z from "zod";

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/**
 * Recursive zod schema mirroring the `Json` type. Used to validate arbitrary
 * JSON values (e.g. widget `content`) at server boundaries.
 */
export const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonSchema),
    z.record(z.string(), jsonSchema),
  ]),
);
