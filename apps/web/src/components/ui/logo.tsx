"use client";

export function Logo({ className = "h-8 w-8" }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            {/* Símbolo: Folha Espiral em formato de Chama */}
            <path
                d="M12 2C12 2 19 6.5 19 12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12C5 8.13401 8.13401 5 12 5V2Z"
                fill="currentColor"
                className="text-brand"
            />
            <path
                d="M12 2C12 2 12 5 12 12H5C5 8.13401 8.13401 2 12 2Z"
                fill="currentColor"
                className="text-brand opacity-60"
            />
            <circle cx="12" cy="12" r="2" fill="currentColor" className="text-bg" />
        </svg>
    );
}
