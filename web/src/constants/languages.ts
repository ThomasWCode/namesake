export const LANGUAGES: { title: string; value: Language }[] = [
  { title: "English", value: "english" },
  { title: "Spanish", value: "spanish" },
];

export type Language = "english" | "spanish";

export const LANGUAGE_LABELS: Record<Language, string> = Object.fromEntries(
  LANGUAGES.map(({ value, title }) => [value, title]),
) as Record<Language, string>;
