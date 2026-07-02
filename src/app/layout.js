import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Sotcenteric | Laboratory Management System",
  description: "Laboratory Management System",
   icons: {
    icon: "/super/softcenteric-logo.webp",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >

      <body className="min-h-full flex flex-col">{children}
        
      </body>
    </html>
  );
}
