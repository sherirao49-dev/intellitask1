import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// 1. Import the AuthProvider
import { AuthProvider } from "./(auth)/context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IntelliTask AI",
  description: "AI-Powered Task Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* 2. Wrap the children in the AuthProvider */}
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}