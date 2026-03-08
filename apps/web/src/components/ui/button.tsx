import * as React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "danger" | "ok" | "ghost";
    isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = "", variant = "primary", isLoading, children, disabled, ...props }, ref) => {
        let baseStyles = "inline-flex items-center justify-center rounded-[4px] font-sans font-bold text-sm transition-all focus-visible:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-bg disabled:opacity-40 disabled:pointer-events-none active:scale-[0.97] min-h-[44px] px-4 w-full interactive";

        let variantStyles = "";
        switch (variant) {
            case "primary":
                variantStyles = "bg-brand text-bg hover:brightness-110 active:brightness-90 border border-brand/20";
                break;
            case "secondary":
                variantStyles = "bg-surface-2 text-text border border-border hover:border-border-2";
                break;
            case "danger":
                variantStyles = "bg-crit-bg text-crit border border-crit-border hover:bg-crit-bg/80";
                break;
            case "ok":
                variantStyles = "bg-ok-bg text-ok border border-ok-border hover:bg-ok-bg/80";
                break;
            case "ghost":
                variantStyles = "bg-transparent text-text-2 hover:text-text hover:bg-surface-2 border border-transparent";
                break;
        }

        return (
            <button
                ref={ref}
                disabled={disabled || isLoading}
                className={`${baseStyles} ${variantStyles} ${className}`}
                {...props}
            >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <span className="truncate">{children}</span>
            </button>
        );
    }
);

Button.displayName = "Button";
