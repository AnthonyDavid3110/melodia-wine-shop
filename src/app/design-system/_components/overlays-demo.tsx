import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function OverlaysDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">Annuler la commande…</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler la commande ECM-2026-0143 ?</DialogTitle>
            <DialogDescription>
              Cette action est tracée. La commande passera au statut « Annulée » et sera exclue des
              besoins en vin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline">Retour</Button>
            <Button variant="destructive">Annuler la commande</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="secondary">Filtres</Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Filtrer les commandes</SheetTitle>
            <SheetDescription>Affiner la liste par statut, membre ou période.</SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <Button>Appliquer</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
