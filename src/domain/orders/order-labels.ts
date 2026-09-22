/** French display labels for Order enum fields (docs/06-ADMIN-SPEC.md), shared by list/detail admin views. */

export function orderStatusLabel(status: string): string {
  switch (status) {
    case "NEW":
      return "Nouvelle";
    case "CONFIRMED":
      return "Confirmée";
    case "PREPARED":
      return "Préparée";
    case "HANDED_TO_SELLER":
      return "Remise au vendeur";
    case "DELIVERED":
      return "Livrée";
    case "CANCELLED":
      return "Annulée";
    default:
      return status;
  }
}

export function customerPaymentStatusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "En attente";
    case "PAID":
      return "Payée";
    case "REFUNDED":
      return "Remboursée";
    default:
      return status;
  }
}

export function sellerSettlementStatusLabel(status: string): string {
  switch (status) {
    case "NOT_APPLICABLE":
      return "Non applicable";
    case "PENDING":
      return "En attente";
    case "SETTLED":
      return "Réglé";
    default:
      return status;
  }
}

export function orderSourceLabel(source: string): string {
  return source === "MANUAL" ? "Manuelle" : "En ligne";
}

export function paymentMethodLabel(method: string): string {
  switch (method) {
    case "SELLER":
      return "Membre";
    case "TWINT":
      return "TWINT";
    case "CARD":
      return "Carte";
    default:
      return method;
  }
}

/** French labels for `Payment.status` (docs/04-DATA-MODEL.md §19) — Phase 10 online-payment attempt history. */
export function paymentAttemptStatusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "En attente";
    case "PROCESSING":
      return "En cours";
    case "SUCCEEDED":
      return "Réussi";
    case "FAILED":
      return "Échoué";
    case "CANCELLED":
      return "Annulé";
    case "REFUNDED":
      return "Remboursé";
    case "PARTIALLY_REFUNDED":
      return "Partiellement remboursé";
    default:
      return status;
  }
}
