import { describe, expect, it } from "vitest";
import { decodeId, decodeIdParam, encodeId, idParam } from "./shortId";

// flickrBase58 alphabet — what an encoded id may legally contain.
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

describe("encodeId / decodeId", () => {
  it("encodes a uuid to a ~22-char base58 string", () => {
    const uuid = "0192f1a0-0000-7000-8000-000000000000";
    const encoded = encodeId(uuid);
    expect(encoded).toBe("1cgQMcNe91gAK62iNAUMKN");
    expect(encoded).toHaveLength(22);
    expect(encoded).toMatch(BASE58);
  });

  it("decodes back to the original lowercase canonical uuid", () => {
    expect(decodeId("1cgQMcNe91gAK62iNAUMKN")).toBe("0192f1a0-0000-7000-8000-000000000000");
  });

  it("round-trips arbitrary uuids losslessly", () => {
    for (let i = 0; i < 100; i++) {
      const uuid = crypto.randomUUID();
      const encoded = encodeId(uuid);
      expect(encoded).toMatch(BASE58);
      expect(encoded.length).toBeLessThanOrEqual(22);
      expect(decodeId(encoded)).toBe(uuid);
    }
  });

  it("throws on input containing non-base58 characters", () => {
    expect(() => decodeId("0")).toThrow(); // '0' is not in the alphabet
    expect(() => decodeId("OIl")).toThrow(); // ambiguous chars are excluded
    expect(() => decodeId("abc!def")).toThrow();
  });
});

describe("idParam", () => {
  const uuid = "0192f1a0-0000-7000-8000-000000000000";
  const short = encodeId(uuid);
  const param = idParam("userId");

  it("stringify encodes the keyed uuid to base58 for the URL", () => {
    expect(param.stringify({ userId: uuid })).toEqual({ userId: short });
  });

  it("parse decodes the keyed base58 back to the uuid", () => {
    expect(param.parse({ userId: short })).toEqual({ userId: uuid });
  });

  it("round-trips parse(stringify(x))", () => {
    expect(param.parse(param.stringify({ userId: uuid }))).toEqual({ userId: uuid });
  });

  it("throws a notFound when the param is not valid base58", () => {
    let thrown: unknown;
    try {
      param.parse({ userId: "not-base58!" });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({ isNotFound: true });
  });
});

describe("decodeIdParam", () => {
  const uuid = "0192f1a0-0000-7000-8000-000000000000";
  const short = encodeId(uuid);

  it("decodes a base58 id-valued search/filter param to the uuid", () => {
    expect(decodeIdParam(short)).toBe(uuid);
  });

  it("returns undefined for an absent param", () => {
    expect(decodeIdParam(undefined)).toBeUndefined();
    expect(decodeIdParam("")).toBeUndefined();
  });

  it("returns undefined (not throw) for a malformed param", () => {
    expect(decodeIdParam("not-base58!")).toBeUndefined();
    expect(decodeIdParam("OIl")).toBeUndefined();
  });
});
