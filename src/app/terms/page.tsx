export const metadata = {
  title: "Terms of Service",
  description: "The terms governing your use of PromptForge.",
  alternates: { canonical: "/terms" },
};

const EFFECTIVE_DATE = "August 1, 2026";

export default function TermsPage() {
  return (
    <div className="container py-20 max-w-2xl">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-3 text-sm text-text-faint">Effective {EFFECTIVE_DATE}</p>

      <div className="mt-10 space-y-10 text-text-muted leading-relaxed [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-text [&_h2]:mb-3 [&_p]:mb-3 [&_li]:mb-1.5">
        <section>
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of PromptForge
            (&quot;PromptForge,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), including our website and
            application (together, the &quot;Service&quot;). By creating an account or otherwise using
            the Service, you agree to be bound by these Terms. If you don&apos;t agree, please don&apos;t
            use the Service.
          </p>
        </section>

        <section>
          <h2>1. Who can use PromptForge</h2>
          <p>
            You must be at least 16 years old, or the age of digital consent in your jurisdiction if
            higher, to use the Service. By using PromptForge, you represent that you meet this
            requirement and that you have the authority to agree to these Terms — on your own behalf,
            or on behalf of an organization you represent.
          </p>
        </section>

        <section>
          <h2>2. Your account</h2>
          <p>
            You&apos;re responsible for maintaining the confidentiality of your account credentials and
            for all activity that occurs under your account. Let us know right away if you suspect
            unauthorized use of your account. You&apos;re responsible for providing accurate account
            information (such as your email address) and keeping it up to date.
          </p>
        </section>

        <section>
          <h2>3. Your content</h2>
          <p>
            &quot;Your Content&quot; means the prompts, prompt bodies, titles, folder and tag names,
            collections, and any other material you create, upload, or store in PromptForge. You retain
            all ownership rights in Your Content. We claim no ownership over it.
          </p>
          <p>
            By storing or submitting Your Content on the Service, you grant us a limited,
            non-exclusive, worldwide license to host, store, reproduce, and display Your Content solely
            as necessary to operate, maintain, and provide the Service to you — for example, to save a
            prompt, sync it across your devices, run an AI assist action on it at your request, or
            display it at a public share link you&apos;ve explicitly created.
          </p>
          <p>
            You&apos;re solely responsible for Your Content and for ensuring you have the rights necessary
            to store and share it through the Service. Don&apos;t upload content that is unlawful,
            infringes someone else&apos;s intellectual property or privacy rights, or that you don&apos;t have
            the right to share.
          </p>
        </section>

        <section>
          <h2>4. Public sharing</h2>
          <p>
            PromptForge lets you mark individual prompts or collections as public, which generates a
            shareable link viewable by anyone who has it, without needing an account. You control this
            setting for each item and can revoke public access at any time. We&apos;re not responsible for
            content you choose to make public, or for what a recipient of a share link does with it
            once viewed.
          </p>
        </section>

        <section>
          <h2>5. AI features</h2>
          <p>
            PromptForge&apos;s AI assist features (Improve, Rewrite, Expand, Shorten) may send the text of
            the prompt you&apos;re editing to a third-party AI provider to generate a suggested result nothing
            is applied to your saved prompt unless you choose to accept it. Suggestions are generated
            automatically and may be inaccurate, irrelevant, or unsuitable for your purpose; review any
            AI-generated suggestion before relying on or applying it. We are not liable for outcomes
            resulting from your use of AI-generated content.
          </p>
        </section>

        <section>
          <h2>6. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-5">
            <li>Use the Service for any unlawful purpose, or to store or distribute unlawful content;</li>
            <li>Attempt to gain unauthorized access to another user&apos;s account or data;</li>
            <li>Interfere with, disrupt, or overburden the Service or its infrastructure;</li>
            <li>Reverse engineer, scrape at scale, or attempt to extract the Service&apos;s source code except as permitted by law;</li>
            <li>Use the Service to generate content intended to harm, harass, deceive, or defraud others.</li>
          </ul>
        </section>

        <section>
          <h2>7. Termination</h2>
          <p>
            You may stop using the Service and delete your account at any time from Settings. We may
            suspend or terminate your access to the Service if you materially violate these Terms.
            Where reasonably possible, we&apos;ll try to give you notice first. Upon termination, your
            right to use the Service ends, though provisions of these Terms that by their nature should
            survive (e.g. ownership, disclaimers, limitations of liability) will continue to apply.
          </p>
        </section>

        <section>
          <h2>8. Service &quot;as is&quot;</h2>
          <p>
            The Service is provided &quot;as is&quot; and &quot;as available,&quot; without warranties of any kind, express
            or implied, including implied warranties of merchantability, fitness for a particular
            purpose, and non-infringement. We don&apos;t guarantee the Service will be uninterrupted,
            secure, or error-free, and we don&apos;t guarantee the accuracy or reliability of any
            AI-generated output.
          </p>
        </section>

        <section>
          <h2>9. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, PromptForge and its team will not be liable for any
            indirect, incidental, special, consequential, or punitive damages, or any loss of data,
            revenue, or profits, arising from your use of or inability to use the Service, even if we
            were advised of the possibility of such damages. Our total liability for any claim arising
            from these Terms or the Service is limited to the amount you paid us, if any, in the twelve
            months before the claim arose.
          </p>
        </section>

        <section>
          <h2>10. Changes to these Terms</h2>
          <p>
            We may update these Terms from time to time. If we make material changes, we&apos;ll provide
            reasonable notice (for example, by email or an in-app notice) before they take effect.
            Continuing to use the Service after changes take effect constitutes acceptance of the
            updated Terms.
          </p>
        </section>

        <section>
          <h2>11. Governing law</h2>
          <p>
            These Terms are governed by the laws of the jurisdiction in which PromptForge is
            established, without regard to conflict-of-law principles, unless applicable local law
            requires otherwise.
          </p>
        </section>

        <section>
          <h2>12. Contact</h2>
          <p>
            Questions about these Terms? Reach out via the <a href="/contact" className="text-accent hover:underline">contact page</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
