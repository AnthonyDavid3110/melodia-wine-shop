"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { demoSellers } from "../_data";

export function FormControls() {
  const [seller, setSeller] = React.useState<string | null>(null);

  return (
    <div className="grid max-w-xl grid-cols-1 gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ds-name">Nom complet</Label>
        <Input id="ds-name" placeholder="Prénom et nom" autoComplete="name" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ds-note">Note de livraison (facultatif)</Label>
        <Textarea id="ds-note" placeholder="Ex. sonnette à gauche, laisser au voisin…" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ds-canton">Canton</Label>
        <Select defaultValue="vd">
          <SelectTrigger id="ds-canton" className="w-full">
            <SelectValue placeholder="Sélectionner un canton" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vd">Vaud</SelectItem>
            <SelectItem value="ge">Genève</SelectItem>
            <SelectItem value="ne">Neuchâtel</SelectItem>
            <SelectItem value="vs">Valais</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ds-seller">Membre Mélodia (optionnel)</Label>
        <Combobox
          triggerAriaLabel="Membre Mélodia"
          options={demoSellers}
          value={seller}
          onChange={setSeller}
          placeholder="Aucun membre sélectionné"
          searchPlaceholder="Rechercher un membre…"
          emptyText="Aucun membre trouvé."
          clearLabel="Aucun membre — livraison directe"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Mode de paiement</legend>
        <RadioGroup defaultValue="twint" className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="twint" id="ds-twint" />
            TWINT — Paiement sécurisé en ligne
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="card" id="ds-card" />
            Carte — Visa / Mastercard
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="seller" id="ds-seller-payment" />
            Paiement à la livraison — payez directement au membre
          </label>
        </RadioGroup>
      </fieldset>

      <label className="flex items-start gap-2 text-sm">
        <Checkbox id="ds-terms" className="mt-0.5" />
        J&apos;accepte les conditions de la vente Mélodia.
      </label>
    </div>
  );
}
