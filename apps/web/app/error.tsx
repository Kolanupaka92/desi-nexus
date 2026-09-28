"use client";

import { useEffect } from "react";
import { StatusPanel } from "@/components/site/StatusPanel";
import { ActionButton, Button } from "@/components/ui/Button";

/**
 * The safety net for anything a page did not handle itself.
 *
 * Without it an unexpected throw showed Next's bare "Application error" with no
 * header, no footer and no way back. The known failure -- an unreachable API --
 * is handled where it happens (see ServiceUnavailable), so reaching this page
 * means something genuinely unanticipated went wrong.
 *
 * It says so honestly and does not guess at a cause: in production Next strips
 * the error's message before it reaches the browser, precisely so a stack trace
 * cannot leak, and leaves only an opaque `digest`. That digest is shown, because
 * it is the one thing that lets a report be matched to a server log.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced in the browser console for anyone debugging; the server log
    // already has the full error under the same digest.
    console.error(error);
  }, [error]);

  return (
    <StatusPanel
      eyebrow="Something went wrong"
      title="This page hit an unexpected error"
      actions={
        <>
          <ActionButton tone="primary" onClick={() => reset()}>
            Try again
          </ActionButton>
          <Button href="/" tone="secondary">
            Back to home
          </Button>
        </>
      }
    >
      <p>It is not something you did. Trying again often works; if it keeps happening, the home page is a safe way back.</p>
      {error.digest ? (
        <p>
          Reference: <code>{error.digest}</code>
        </p>
      ) : null}
    </StatusPanel>
  );
}
