import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ErrorProvider } from "@/contexts/ErrorContext";
import { ErrorToastContainer, LoadingOverlay, ErrorSummary } from "@/components/ErrorToast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EquipRent - Equipment Rental Management",
  description: "Professional equipment rental management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ErrorProvider>
          <ErrorBoundary>
            {children}
            <ErrorToastContainer />
            <LoadingOverlay />
            <ErrorSummary />
          </ErrorBoundary>
        </ErrorProvider>
      </body>
    </html>
  );
}
