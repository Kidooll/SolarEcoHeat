import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className = "", label, error, ...props }, ref) => {
        return (
            <div className="w-full flex flex-col gap-1.5">
                {label && (
                    <label className="text-sm font-sans font-medium text-text-2">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    className={`flex min-h-[44px] w-full rounded-[4px] border bg-surface-2 px-3 py-2 text-sm text-text
            focus-visible:outline-none focus:ring-1 focus:ring-accent-border/50
            disabled:cursor-not-allowed disabled:opacity-50
            placeholder:text-text-3 transition-colors
            ${error ? "border-crit/50 bg-crit-bg/20" : "border-border hover:border-border-2"}
            ${className}`}
                    {...props}
                />
                {error && <span className="text-xs text-crit font-sans mt-0.5">{error}</span>}
            </div>
        );
    }
);

Input.displayName = "Input";
