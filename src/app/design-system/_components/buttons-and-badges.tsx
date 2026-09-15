import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";

export function ButtonsAndBadges() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="default">Ajouter au panier</Button>
        <Button variant="outline">Voir le détail</Button>
        <Button variant="secondary">Filtrer</Button>
        <Button variant="ghost">Annuler</Button>
        <Button variant="destructive">Annuler la commande</Button>
        <Button variant="link">Soutenir Mélodia</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg">Découvrir les vins</Button>
        <Button size="default">Ajouter</Button>
        <Button size="sm">Modifier</Button>
        <Button size="icon" aria-label="Voir le panier">
          <CartIcon />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge>Nouveau</Badge>
        <Badge variant="secondary">Carton découverte</Badge>
        <Badge variant="outline">Blanc</Badge>
        <Badge variant="destructive">Épuisé</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone="neutral">Nouvelle</StatusBadge>
        <StatusBadge tone="accent">Confirmée</StatusBadge>
        <StatusBadge tone="warning">Préparée</StatusBadge>
        <StatusBadge tone="success">Livrée</StatusBadge>
        <StatusBadge tone="danger">Annulée</StatusBadge>
      </div>
    </div>
  );
}

function CartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6h2l1.5 11.5A2 2 0 0 0 9.5 19h8a2 2 0 0 0 2-1.8L21 8H7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="21" r="1.2" fill="currentColor" />
      <circle cx="17" cy="21" r="1.2" fill="currentColor" />
    </svg>
  );
}
