import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login - IT Aware",
  description: "Login to IT Aware Platform",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
