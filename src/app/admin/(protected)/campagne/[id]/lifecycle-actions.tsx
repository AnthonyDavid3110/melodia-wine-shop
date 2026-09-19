"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  campaignEventTypeForTransition,
  isValidCampaignTransition,
  type CampaignStatus,
} from "@/domain/campaign/campaign-status";
import { transitionCampaignStatusAction, type CampaignTransitionState } from "../actions";

const ALL_STATUSES: CampaignStatus[] = ["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"];

interface TransitionOption {
  to: CampaignStatus;
  label: string;
  title: string;
  description: string;
  destructive?: boolean;
}

function transitionOptionsFor(status: CampaignStatus): TransitionOption[] {
  return ALL_STATUSES.filter((to) => isValidCampaignTransition(status, to)).map((to) => {
    const eventType = campaignEventTypeForTransition(status, to);
    switch (eventType) {
      case "ACTIVATED":
        return {
          to,
          label: "Activer",
          title: "Activer cette campagne ?",
          description:
            "La campagne deviendra la campagne publique. Elle sera immédiatement visible et commandable sur le site.",
        };
      case "REOPENED":
        return {
          to,
          label: "Réouvrir",
          title: "Réouvrir cette campagne ?",
          description:
            "La campagne redeviendra la campagne publique et sera immédiatement visible et commandable sur le site.",
        };
      case "CLOSED":
        return {
          to,
          label: "Clôturer",
          title: "Clôturer cette campagne ?",
          description:
            "La campagne ne sera plus visible publiquement. Elle peut être réouverte ultérieurement si nécessaire.",
        };
      case "ARCHIVED":
        return {
          to,
          label: "Archiver",
          title: "Archiver cette campagne ?",
          description:
            "Cette action est définitive : une campagne archivée ne peut plus être réactivée.",
          destructive: true,
        };
    }
  });
}

function TransitionButton({
  campaignId,
  option,
}: {
  campaignId: string;
  option: TransitionOption;
}) {
  const [open, setOpen] = useState(false);
  const action = transitionCampaignStatusAction.bind(null, campaignId, option.to);
  const [state, formAction, isPending] = useActionState<CampaignTransitionState, FormData>(
    action,
    {},
  );

  // Close the dialog once a submission on it completes without error —
  // done during render (React's sanctioned "adjust state when a prop
  // changes" pattern), not in a `useEffect`, to avoid the extra
  // cascading render that setState-in-effect would cost here.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (open && !state.formError) {
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant={option.destructive ? "destructive" : "outline"}
        onClick={() => setOpen(true)}
        type="button"
      >
        {option.label}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{option.title}</DialogTitle>
          <DialogDescription>{option.description}</DialogDescription>
        </DialogHeader>
        {state.formError ? (
          <p role="alert" className="text-danger text-body-sm font-sans">
            {state.formError}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Retour
          </Button>
          <form action={formAction}>
            <Button
              variant={option.destructive ? "destructive" : "default"}
              type="submit"
              disabled={isPending}
            >
              {isPending ? "En cours…" : option.label}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CampaignLifecycleActions({
  campaignId,
  status,
}: {
  campaignId: string;
  status: CampaignStatus;
}) {
  const options = transitionOptionsFor(status);
  if (options.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <TransitionButton key={option.to} campaignId={campaignId} option={option} />
      ))}
    </div>
  );
}
