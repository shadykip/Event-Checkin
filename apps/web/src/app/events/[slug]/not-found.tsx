import { publicStyles } from "../../public-styles";
import Link from "next/link";
import PublicShell from "../../public-shell";

export default function EventNotFound() {
  return (
    <PublicShell>
      <main id="main-content" className={publicStyles.container}>
        <div className={publicStyles.empty}>
          <h1>Event unavailable</h1>
          <p>
            This event could not be found. Explore the other events available.
          </p>
          <Link href="/" className={publicStyles.primary}>
            Explore events
          </Link>
        </div>
      </main>
    </PublicShell>
  );
}
