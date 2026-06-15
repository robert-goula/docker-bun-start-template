export const TARGET_PARAMS = {
  algorithm: "argon2id",
  memoryCost: 19456,
  timeCost: 3,
} as const;

export type Argon2Params = {
  algorithm: "argon2id" | "argon2d" | "argon2i";
  memoryCost: number;
  timeCost: number;
};

const ENCODED_PREFIX_RE =
  /^\$(argon2(?:id|i|d))\$v=\d+\$m=(\d+),t=(\d+),p=\d+\$/;

export function parseEncoded(encoded: string): Argon2Params | null {
  const m = ENCODED_PREFIX_RE.exec(encoded);
  if (!m) return null;
  return {
    algorithm: m[1] as Argon2Params["algorithm"],
    memoryCost: Number(m[2]),
    timeCost: Number(m[3]),
  };
}

export function needsRehash(encoded: string): boolean {
  const parsed = parseEncoded(encoded);
  if (!parsed) return true;
  return (
    parsed.algorithm !== TARGET_PARAMS.algorithm ||
    parsed.memoryCost < TARGET_PARAMS.memoryCost ||
    parsed.timeCost < TARGET_PARAMS.timeCost
  );
}

export const PasswordHasher = {
  hash: (plain: string): Promise<string> => Bun.password.hash(plain, TARGET_PARAMS),
  verify: (plain: string, hash: string): Promise<boolean> =>
    Bun.password.verify(plain, hash, "argon2id"),
  needsRehash,
  parseEncoded,
  TARGET_PARAMS,
};
