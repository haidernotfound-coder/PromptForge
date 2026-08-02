export const metadata = {
  title: "Privacy Policy",
  description: "How NexPrompt collects, stores, and protects your data.",
  alternates: { canonical: "/privacy" },
};

const EFFECTIVE_DATE = "August 1, 2026";

export default function PrivacyPage() {
  return (
    <div className="container py-20 max-w-2xl">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-3 text-sm text-text-faint">Effective {EFFECTIVE_DATE}</p>

      <div className="mt-10 space-y-10 text-text-muted leading-relaxed [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-text [&_h2]:mb-3 [&_p]:mb-3 [&_li]:mb-1.5">
        <section>
          <p>
            This Privacy Policy explains what information NexPrompt (&quot;we,&quot; &quot;us,&quot; or
            &quot;our&quot;) collects, how we use it, and the choices you have. It applies to our website
            and application (together, the &quot;Service&quot;).
          </p>
        </section>

        <section>
          <h2>1. Information we collect</h2>
          <p><strong className="text-text">Account information.</strong> If you create an account, we
            collect your email address, the display name you provide, and a hashed password (we never
            store your password in plain text — password hashing and authentication are handled by our
            authentication provider, Supabase).
          </p>
          <p><strong className="text-text">Your content.</strong> The prompts, prompt bodies, titles,
            folders, tags, and collections you create — the actual content of your workspace.
          </p>
          <p><strong className="text-text">Usage &amp; device information.</strong> Basic technical
            information such as browser type, general region (derived from IP address, not stored
            precisely), and pages visited, used for security, debugging, and understanding aggregate
            product usage.
          </p>
          <p><strong className="text-text">Local/device storage.</strong> If you use NexPrompt without
            an account (demo mode), your data is stored only in your browser&apos;s local storage and a
            session cookie, and is never transmitted to our servers.
          </p>
        </section>

        <section>
          <h2>2. How we use your information</h2>
          <ul className="list-disc pl-5">
            <li>To provide, maintain, and secure the Service, including syncing your workspace across your devices;</li>
            <li>To authenticate you and protect your account from unauthorized access;</li>
            <li>To operate AI assist features, which send the specific prompt text you act on to our AI provider to generate a suggestion (see Section 4);</li>
            <li>To communicate with you about your account, such as password resets or security notices;</li>
            <li>To understand aggregate usage patterns so we can improve the Service;</li>
            <li>To comply with legal obligations and enforce our Terms of Service.</li>
          </ul>
          <p>We do not sell your personal information, and we do not use the content of your prompts to train AI models.</p>
        </section>

        <section>
          <h2>3. Where your data is stored</h2>
          <p>
            When you create an account, your workspace (prompts, folders, tags, collections) and
            account information are stored in a hosted Postgres database provided by Supabase, protected
            by row-level security policies that scope every record to your own account — no other user
            can query or read your data through the application. Backups you create locally within the
            app are stored in your browser and are not uploaded to our servers.
          </p>
        </section>

        <section>
          <h2>4. AI providers</h2>
          <p>
            When you run an AI assist action (Improve, Rewrite, Expand, Shorten), the text of the
            specific prompt you&apos;re acting on is sent to our AI provider (Anthropic) to generate a
            suggested result, then discarded — we don&apos;t direct the provider to retain it for training.
            Refer to Anthropic&apos;s own privacy policy for how they handle API data. No AI action runs
            automatically; it only runs when you click an AI action button.
          </p>
        </section>

        <section>
          <h2>5. Sharing your information</h2>
          <p>We share information only in the following circumstances:</p>
          <ul className="list-disc pl-5">
            <li><strong className="text-text">Service providers</strong> who host our infrastructure or process data on our behalf (e.g. Supabase for authentication and database hosting, Anthropic for AI assist requests), under contractual obligations to protect it;</li>
            <li><strong className="text-text">Public share links</strong> you explicitly create — anyone with the link can view that specific prompt or collection;</li>
            <li><strong className="text-text">Legal requirements</strong>, if we&apos;re required to disclose information to comply with a law, regulation, or valid legal process;</li>
            <li><strong className="text-text">Business transfers</strong>, if NexPrompt is involved in a merger, acquisition, or asset sale, subject to standard confidentiality protections.</li>
          </ul>
        </section>

        <section>
          <h2>6. Your choices and rights</h2>
          <ul className="list-disc pl-5">
            <li><strong className="text-text">Access &amp; export.</strong> Export your entire workspace as JSON at any time from Settings → Data.</li>
            <li><strong className="text-text">Correction.</strong> Update your display name and account email from Settings → Account.</li>
            <li><strong className="text-text">Deletion.</strong> Delete individual prompts, folders, tags, or collections at any time; contact us via the contact page to request deletion of your account and associated data.</li>
            <li><strong className="text-text">Unsharing.</strong> Revoke a public share link at any time by turning off &quot;Public&quot; for that prompt or collection.</li>
          </ul>
          <p>
            Depending on where you live, you may have additional rights under applicable law (such as
            the GDPR or CCPA), including the right to object to or restrict certain processing. Contact
            us to exercise these rights.
          </p>
        </section>

        <section>
          <h2>7. Data retention</h2>
          <p>
            We retain your account and workspace data for as long as your account is active. If you
            delete your account, we delete your workspace data and personal information within a
            reasonable period, except where we&apos;re required to retain certain records for legal,
            security, or fraud-prevention purposes.
          </p>
        </section>

        <section>
          <h2>8. Security</h2>
          <p>
            We use industry-standard measures to protect your data, including encryption in transit
            (TLS), row-level security on all database access, and hashed password storage. No method of
            transmission or storage is 100% secure, and we can&apos;t guarantee absolute security.
          </p>
        </section>

        <section>
          <h2>9. Children&apos;s privacy</h2>
          <p>
            The Service is not directed to children under 16, and we do not knowingly collect personal
            information from them. If you believe a child has provided us with personal information,
            please contact us so we can remove it.
          </p>
        </section>

        <section>
          <h2>10. International data transfers</h2>
          <p>
            Our service providers may process data in countries other than your own. Where required, we
            rely on appropriate safeguards (such as standard contractual clauses) for these transfers.
          </p>
        </section>

        <section>
          <h2>11. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. If we make material changes, we&apos;ll
            provide reasonable notice (for example, by email or an in-app notice) before they take
            effect.
          </p>
        </section>

        <section>
          <h2>12. Contact us</h2>
          <p>
            Questions about this policy or your data? Reach out via the{" "}
            <a href="/contact" className="text-accent hover:underline">contact page</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
