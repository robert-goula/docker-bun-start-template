import { useIntlayer } from "react-intlayer";

export default function Footer() {
  const year = new Date().getFullYear();
  const content = useIntlayer("footer");

  return (
    <footer>
      <section className="full">
        <p className="text-sm">
          © {year} {content.rights}
        </p>
      </section>
    </footer>
  );
}
