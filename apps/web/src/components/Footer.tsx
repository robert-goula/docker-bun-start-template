export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer>
      <section className="full">
        <p className="text-sm">© {year} All rights reserved.</p>
      </section>
    </footer>
  );
}
