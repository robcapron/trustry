import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Boutons en pilule (maquettes) : primaire carbone + texte fluo, secondaire blanc bordé. */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border font-semibold transition-[filter,background-color] hover:brightness-[0.97] disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        primary: "border-carbone bg-carbone text-fluo",
        secondary: "border-line bg-blanc text-ink",
        accent: "border-fluo bg-fluo text-carbone",
        ghost: "border-transparent bg-transparent text-ink-2 hover:bg-surface",
      },
      size: {
        md: "h-10 px-[18px] text-nav",
        sm: "h-[34px] px-3.5 text-meta",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp type={asChild ? undefined : (type ?? "button")} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
