import Link from "next/link";

const concepts = [
  {
    slug: "programme",
    title: "1. Programme",
    subtitle: "Editorial concert-booklet — original",
    swatch: ["#F4EEE4", "#1B1712", "#7A2E2E"],
    description:
      "Warm paper tones, a serif display face, and a numbered concert-programme structure. Wines read as programme entries rather than shop tiles. Kept for reference — superseded by Programme V2 below.",
  },
  {
    slug: "cuivres",
    title: "2. Cuivres",
    subtitle: "Swiss modernist grid",
    swatch: ["#F5F5F2", "#111111", "#C8102E"],
    description:
      "A disciplined single-typeface grid with ECM red held to small, precise uses. The most literal ECM brand connection of the three.",
  },
  {
    slug: "sourdine",
    title: "3. Sourdine",
    subtitle: "Warm nocturne",
    swatch: ["#241318", "#F1E7D8", "#C9A66B"],
    description:
      "A dark, atmospheric evening-reception mood with a high-contrast serif display and gold accent. The most emotionally driven direction.",
  },
  {
    slug: "programme-v2",
    title: "Programme V2",
    subtitle: "Selected direction — refined",
    swatch: ["#F4EEE4", "#EEDFC4", "#7A2E2E"],
    description:
      "Programme, refined: bottles given real editorial weight and warmth (borrowed from Sourdine), a disciplined grid and confident CTAs (borrowed from Cuivres) — without inheriting either's dark/gold or institutional/cold language.",
  },
];

export default function DesignExplorationIndexPage() {
  return (
    <main
      style={{
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
      className="mx-auto max-w-3xl px-4 py-12"
    >
      <h1 className="text-2xl font-semibold text-neutral-900">
        Les Vins de Mélodia — Phase 1 design exploration
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-600">
        Three genuinely distinct visual directions were compared, using the same placeholder content
        and products. <strong>Programme</strong> was selected as the primary direction;{" "}
        <strong>Programme V2</strong> is its refinement and the current candidate. Nothing here is
        production code or final content — see each concept page for details on what is still
        placeholder.
      </p>

      <ul className="mt-10 flex flex-col gap-6">
        {concepts.map((concept) => (
          <li key={concept.slug}>
            <Link
              href={`/design/${concept.slug}`}
              className="group flex items-center gap-4 rounded-lg border border-neutral-200 p-4 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
            >
              <span className="flex shrink-0 gap-1">
                {concept.swatch.map((color, index) => (
                  <span
                    key={index}
                    className="block h-10 w-6 rounded-sm border border-black/5"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                ))}
              </span>
              <span>
                <span className="block text-base font-semibold text-neutral-900 group-hover:underline">
                  {concept.title} — {concept.subtitle}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-neutral-600">
                  {concept.description}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
