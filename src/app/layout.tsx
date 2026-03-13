import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SocketProvider } from "@/providers/SocketProvider";
import NotificationToast from "@/components/NotificationToast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SKREW – Multiplayer Card Game",
  description:
    "Real-time multiplayer Screw card game. Get the lowest hand, call SCREW, and outsmart your opponents!",
  keywords: ["screw", "card game", "multiplayer", "online", "real-time"],
  openGraph: {
    title: "SKREW – Multiplayer Card Game",
    description: "Real-time multiplayer Screw card game",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-gray-950 text-white">
        <SocketProvider>
          {children}
          <NotificationToast />
        </SocketProvider>
      </body>
    </html>
  );
}
