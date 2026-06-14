import { EXAMPLE_SNIPPETS } from "@/features/examples/data/example-snippets";

export const DEFAULT_SNIPPET_ID = "event-loop-classic";

/** Returns the default JSV9000-style starter snippet. */
export function getDefaultSnippet() {
  return (
    EXAMPLE_SNIPPETS.find((snippet) => snippet.id === DEFAULT_SNIPPET_ID) ??
    EXAMPLE_SNIPPETS[0]
  );
}
