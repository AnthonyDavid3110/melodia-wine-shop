import { Metadata } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

const swatches: Array<{
  name: string;
  token: string;
  hex: string;
  usage: string;
  textClass: string;
  bgClass: string;
}> = [
  {
    name: "Paper",
    token: "--background",
    hex: "#F4EEE4",
    usage: "Page background",
    textClass: "text-foreground",
    bgClass: "bg-background",
  },
  {
    name: "Ink",
    token: "--foreground",
    hex: "#1B1712",
    usage: "Body text, primary buttons",
    textClass: "text-background",
    bgClass: "bg-foreground",
  },
  {
    name: "Oxblood",
    token: "--accent",
    hex: "#7A2E2E",
    usage: "Accent, links, focus ring",
    textClass: "text-accent-foreground",
    bgClass: "bg-accent",
  },
  {
    name: "Sand",
    token: "--sand",
    hex: "#EEDFC4",
    usage: "Photography surface only",
    textClass: "text-sand-foreground",
    bgClass: "bg-sand",
  },
  {
    name: "Surface",
    token: "--surface",
    hex: "#FAF7F0",
    usage: "Cards, dialogs, popovers",
    textClass: "text-surface-foreground",
    bgClass: "bg-surface border border-border",
  },
  {
    name: "Surface muted",
    token: "--surface-muted",
    hex: "#E7E2D6",
    usage: "Secondary panels, table stripes",
    textClass: "text-surface-muted-foreground",
    bgClass: "bg-surface-muted",
  },
];

const statusSwatches: Array<{ name: string; token: string; hex: string; contrast: string }> = [
  { name: "Success", token: "--success", hex: "#3F6B4A", contrast: "5.33:1 on paper" },
  {
    name: "Warning",
    token: "--warning",
    hex: "#8A5F27",
    contrast: "4.86:1 on paper (adjusted, see docs)",
  },
  { name: "Danger", token: "--danger", hex: "#B23A2E", contrast: "5.14:1 on paper" },
];

export function ColorTokens() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {swatches.map((s) => (
          <div key={s.name} className="flex flex-col gap-2">
            <div
              className={cn(
                "flex h-20 flex-col justify-end rounded-sm p-2 text-xs",
                s.bgClass,
                s.textClass,
              )}
            >
              {s.hex}
            </div>
            <div>
              <p className="text-sm font-medium">{s.name}</p>
              <Metadata as="p">{s.token}</Metadata>
              <Metadata as="p">{s.usage}</Metadata>
            </div>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-3 text-sm font-medium">
          Semantic status colours{" "}
          <span className="text-muted-foreground font-normal">
            — functional, not campaign-identity colours
          </span>
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {statusSwatches.map((s) => (
            <div
              key={s.name}
              className="border-border flex items-center gap-3 rounded-sm border p-3"
            >
              <span
                className="size-8 shrink-0 rounded-sm"
                style={{ backgroundColor: s.hex }}
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium">
                  {s.name} <span className="text-muted-foreground font-normal">{s.hex}</span>
                </p>
                <Metadata as="p">{s.contrast}</Metadata>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
