import Image from "next/image";

/**
 * The public campaign logo — replaces the text `BrandMark` wordmark in
 * the header only (the footer keeps the text wordmark; not part of
 * this change). Served as a local static asset under `public/brand/`,
 * never through the Vercel Blob admin-upload pipeline — that pipeline
 * exists for campaign-editable product/bundle photography, not a
 * fixed brand asset committed to the repository.
 */
export function BrandLogo() {
  return (
    <Image
      src="/brand/les-vins-de-melodia-logo.png"
      alt="Les Vins de Mélodia"
      width={1254}
      height={1254}
      priority
      className="h-16 w-16 object-contain sm:h-20 sm:w-20"
    />
  );
}
