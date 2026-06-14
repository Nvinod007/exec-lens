import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EXAMPLE_SNIPPETS } from "@/features/examples/data/example-snippets";
import { CUSTOM_SNIPPET_ID } from "@/features/examples/constants";

interface PlaygroundToolbarProps {
  selectedExample: string;
  language: "javascript" | "typescript";
  onExampleChange: (exampleId: string) => void;
  onLanguageChange: (language: "javascript" | "typescript") => void;
}

/** Snippet picker and language selector. */
export function PlaygroundToolbar({
  selectedExample,
  language,
  onExampleChange,
  onLanguageChange,
}: PlaygroundToolbarProps) {
  const activeExample = EXAMPLE_SNIPPETS.find((example) => example.id === selectedExample);
  const languageMismatch =
    activeExample !== undefined && activeExample.language !== language;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={selectedExample} onValueChange={onExampleChange}>
        <SelectTrigger className="h-9 w-[170px] text-sm">
          <SelectValue placeholder="Example">
            {selectedExample === CUSTOM_SNIPPET_ID
              ? "Custom code"
              : activeExample?.title ?? "Example"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CUSTOM_SNIPPET_ID} disabled>
            Custom code
          </SelectItem>
          {EXAMPLE_SNIPPETS.map((example) => (
            <SelectItem key={example.id} value={example.id}>
              {example.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={language}
        onValueChange={(value: "javascript" | "typescript") => onLanguageChange(value)}
      >
        <SelectTrigger
          className="h-9 w-[110px] text-sm"
          title={
            languageMismatch
              ? `Example is ${activeExample?.language === "typescript" ? "TS" : "JS"} — Run uses ${language === "typescript" ? "TS" : "JS"} mode`
              : undefined
          }
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="javascript">JS</SelectItem>
          <SelectItem value="typescript">TS</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
