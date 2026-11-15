import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Déclare les tailles de texte du design system pour que tailwind-merge
// ne les confonde pas avec des couleurs (ex: text-meta vs text-muted).
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["tiny", "2xs", "caption", "meta", "ui", "nav", "title", "chart", "kpi", "display", "hero"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
