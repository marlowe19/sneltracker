import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Snel tracker",
  description: "Snel tracker voor klanten",
  icons: {
    icon: "/icon-SO.svg",
  },
  manifest: "/manifest.json",
  themeColor: "#008eff",
  viewport: {
    width: "device-width",
    initialScale: 1,
  },
  twitter: {
    card: "summary_large_image",
    title: "Snel tracker",
    description: "Snel tracker voor klanten",
    images: ["/icon-SO.svg"],
  },
  openGraph: {
    type: "website",
    url: "https://sneltrack.vercel.app",
    title: "Snel tracker",
    description: "Snel tracker voor klanten",
    images: ["/icon-SO.svg"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${jakartaSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="fixed top-3 left-3 z-50">
          <img
            src="/icon-SO.svg"
            alt="SO icon"
            width="28"
            height="22"
            className="opacity-60"
          />
        </header>
        {children}
      </body>
    </html>
  );
}
