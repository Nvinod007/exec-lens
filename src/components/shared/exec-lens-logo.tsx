import { cn } from "@/lib/utils";

/** Logo mark variants — set `variant` on ExecLensLogo or favicon to match. */
export type ExecLensLogoVariant = "aperture" | "magnifier" | "brackets" | "stack";

interface ExecLensLogoProps {
  variant?: ExecLensLogoVariant;
  className?: string;
}

/** ExecLens mark — shared by header; favicon uses the same `aperture` paths in icon.svg. */
export function ExecLensLogo({ variant = "aperture", className }: ExecLensLogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-full", className)}
      aria-hidden
    >
      {variant === "aperture" ? <AperturePaths /> : null}
      {variant === "magnifier" ? <MagnifierPaths /> : null}
      {variant === "brackets" ? <BracketsPaths /> : null}
      {variant === "stack" ? <StackPaths /> : null}
    </svg>
  );
}

/** Current header default — lens iris (matches Lucide Aperture). No “JS” text needed. */
function AperturePaths() {
  return (
    <>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.75" opacity="0.35" />
      <path
        d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 8.5V6M12 18v-2.5M8.5 12H6M18 12h-2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </>
  );
}

/** Favicon-style magnifying lens + crosshair. */
function MagnifierPaths() {
  return (
    <>
      <circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M14.5 14.5L19 19" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M8 10.5h5M10.5 8v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />
      <circle cx="10.5" cy="10.5" r="1" fill="currentColor" />
    </>
  );
}

/** `{ }` inside a lens — subtle JS hint without letters. */
function BracketsPaths() {
  return (
    <>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M9.5 8.5c-1.2 0-2 .8-2 2v3c0 1.2.8 2 2 2M14.5 8.5c1.2 0 2 .8 2 2v3c0 1.2-.8 2-2 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </>
  );
}

/** Three stack layers — call-stack metaphor. */
function StackPaths() {
  return (
    <>
      <rect x="5" y="5" width="14" height="4.5" rx="1.25" stroke="currentColor" strokeWidth="1.5" />
      <rect x="5" y="10.75" width="14" height="4.5" rx="1.25" stroke="currentColor" strokeWidth="1.5" opacity="0.75" />
      <rect x="5" y="16.5" width="14" height="4.5" rx="1.25" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
    </>
  );
}
