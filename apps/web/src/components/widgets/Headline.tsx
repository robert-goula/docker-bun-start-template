import { Headline as HeadlineText } from "@/components/ui/typography";
import type { Json } from "@/types/Json";
import type { DynamicDisplayProps } from "./Dynamic";

const asString = (value: Json | undefined): string =>
  value == null ? "" : typeof value === "string" ? value : String(value);

export default function Headline({ values }: DynamicDisplayProps) {
  const kicker = asString(values.kicker).trim();
  const headline = asString(values.headline).trim();

  if (kicker === "" && headline === "") return null;

  return (
    <>
      {kicker !== "" && <p className="kicker">{kicker}</p>}
      {headline !== "" && <HeadlineText as="h1">{headline}</HeadlineText>}
    </>
  );
}
