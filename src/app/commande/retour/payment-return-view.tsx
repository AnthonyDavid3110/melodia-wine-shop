"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Body, Eyebrow, H1 } from "@/components/ui/typography";
import { checkOnlinePaymentStatusAction, retryOnlinePaymentAction } from "./actions";

type Status = "SUCCEEDED" | "PROCESSING" | "FAILED" | "CANCELLED" | "NOT_FOUND";

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 10;

/**
 * Renders the trusted payment state and — while still PROCESSING —
 * polls for the authoritative result a few times (Gate 10B §12/§21).
 * This is in-page polling triggered by an open browser tab, not a
 * background job/cron (explicitly out of scope for this gate). Never
 * infers success/failure client-side; every state shown here comes
 * from a server round trip to `confirmOnlinePayment()`.
 */
export function PaymentReturnView({
  returnToken,
  initialStatus,
  orderNumber,
}: {
  returnToken: string | null;
  initialStatus: Status;
  orderNumber: string | null;
}) {
  const [status, setStatus] = React.useState<Status>(initialStatus);
  const [resolvedOrderNumber, setResolvedOrderNumber] = React.useState<string | null>(orderNumber);
  const [pollCount, setPollCount] = React.useState(0);
  const [retrying, setRetrying] = React.useState(false);
  const [retryError, setRetryError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (status !== "PROCESSING" || !returnToken || pollCount >= MAX_POLLS) {
      return;
    }
    const timer = setTimeout(async () => {
      const result = await checkOnlinePaymentStatusAction(returnToken);
      setStatus(result.status);
      if (result.orderNumber) {
        setResolvedOrderNumber(result.orderNumber);
      }
      setPollCount((count) => count + 1);
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [status, returnToken, pollCount]);

  async function handleRetry(method: "TWINT" | "CARD") {
    if (!returnToken) return;
    setRetrying(true);
    setRetryError(null);
    const result = await retryOnlinePaymentAction(returnToken, method);
    if (result.status === "redirect") {
      window.location.assign(result.redirectUrl);
      return;
    }
    setRetrying(false);
    setRetryError(result.message);
  }

  if (status === "SUCCEEDED") {
    return (
      <div className="flex flex-col gap-4 text-center">
        <Eyebrow className="justify-center">Paiement confirmé</Eyebrow>
        <H1 className="text-3xl">{resolvedOrderNumber ?? "Commande confirmée"}</H1>
        <Body className="text-foreground/70">
          Merci ! Votre paiement a été confirmé et votre commande est enregistrée.
        </Body>
        <Button asChild className="mx-auto mt-4">
          <Link href="/">Retour à l&rsquo;accueil</Link>
        </Button>
      </div>
    );
  }

  if (status === "FAILED" || status === "CANCELLED") {
    return (
      <div className="flex flex-col gap-4 text-center">
        <Eyebrow className="justify-center">
          {status === "CANCELLED" ? "Paiement annulé" : "Paiement refusé"}
        </Eyebrow>
        <H1 className="text-2xl">
          {status === "CANCELLED"
            ? "Vous avez annulé le paiement."
            : "Le paiement n'a pas pu être effectué."}
        </H1>
        <Body className="text-foreground/70">
          Votre commande {resolvedOrderNumber ?? ""} reste enregistrée. Vous pouvez réessayer ou
          choisir le paiement au membre lors de la livraison.
        </Body>
        {retryError ? (
          <p role="alert" className="text-danger text-body-sm font-sans">
            {retryError}
          </p>
        ) : null}
        <div className="mx-auto mt-4 flex flex-col gap-3 sm:flex-row">
          <Button type="button" disabled={retrying} onClick={() => handleRetry("TWINT")}>
            Réessayer avec TWINT
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={retrying}
            onClick={() => handleRetry("CARD")}
          >
            Réessayer par carte
          </Button>
        </div>
      </div>
    );
  }

  if (status === "NOT_FOUND") {
    return (
      <div className="flex flex-col gap-4 text-center">
        <Eyebrow className="justify-center">Paiement introuvable</Eyebrow>
        <Body className="text-foreground/70">
          Nous n&rsquo;avons pas pu retrouver cette tentative de paiement. Si vous venez de passer
          une commande, vérifiez votre e-mail ou contactez Mélodia.
        </Body>
        <Button asChild className="mx-auto mt-4">
          <Link href="/">Retour à l&rsquo;accueil</Link>
        </Button>
      </div>
    );
  }

  // PROCESSING
  return (
    <div className="flex flex-col gap-4 text-center">
      <Eyebrow className="justify-center">Vérification du paiement</Eyebrow>
      <H1 className="text-2xl">Vérification en cours…</H1>
      <Body className="text-foreground/70">
        Nous confirmons votre paiement auprès de notre prestataire. Cela peut prendre quelques
        instants.
      </Body>
    </div>
  );
}
