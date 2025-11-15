import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavigationWrapper from "./components/NavigationWrapper";
import { ToastProvider } from "./components/Toast";

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

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#008eff",
};

export default function RootLayout({ children }) {
  return (
    <html lang="nl">
      <head>
        {/* iOS Safari PWA Meta Tags for iPhone 15+ and iOS 16+ */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Snel tracker" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
        {/* Apple Touch Icons for iPhone 15+ and various iOS devices */}
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/appimages/ios/app-logo-180.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="192x192"
          href="/appimages/ios/192.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="512x512"
          href="/appimages/ios/app-logo-512.png"
        />
      </head>
      <body
        className={`${jakartaSans.variable} ${geistMono.variable} antialiased bg-white`}
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <ToastProvider>
          {children}
          <NavigationWrapper />
        </ToastProvider>
      </body>
    </html>
  );
}
