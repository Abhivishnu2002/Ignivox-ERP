import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 bg-sidebar relative overflow-hidden">
        {/* Background grid pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(oklch(0.6 0.22 264 / 0.4) 1px, transparent 1px),
              linear-gradient(90deg, oklch(0.6 0.22 264 / 0.4) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }}
        />

        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ background: "radial-gradient(circle, oklch(0.62 0.22 264), transparent)" }}
        />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full blur-3xl opacity-15"
          style={{ background: "radial-gradient(circle, oklch(0.75 0.18 75), transparent)" }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, oklch(0.62 0.22 264), oklch(0.72 0.18 290))" }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 5h14M3 10h10M3 15h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-xl font-bold text-sidebar-foreground tracking-tight">
              Ignivox ERP
            </span>
          </div>

          {/* Main copy */}
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold text-sidebar-foreground leading-tight">
                The ERP that{" "}
                <span className="gradient-text">fits your business,</span>
                <br />
                not the other way around.
              </h1>
              <p className="mt-4 text-sidebar-foreground/60 text-lg max-w-md">
                Custom fields, configurable pipelines, and role-based access — all in one platform built for modern manufacturing.
              </p>
            </div>

            {/* Feature list */}
            <div className="grid grid-cols-2 gap-3 max-w-md">
              {[
                "CRM & Lead management",
                "Work orders & BOMs",
                "Real-time inventory",
                "Custom field engine",
                "Configurable pipelines",
                "Role-based access control",
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm text-sidebar-foreground/70">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  {feature}
                </div>
              ))}
            </div>
          </div>

          <p className="text-sidebar-foreground/30 text-sm">
            © 2026 Ignivox ERP. Multi-tenant SaaS for make-to-order manufacturing.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, oklch(0.62 0.22 264), oklch(0.72 0.18 290))" }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 5h14M3 10h10M3 15h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight">Ignivox ERP</span>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
