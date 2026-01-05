import type { Metadata } from "next";
import "./globals.css";
import "./reddit-post.css";
import BotButton from "./components/BotButton";
import "./components/GlobalBotButton.css";

export const metadata: Metadata = {
  title: "C00KIE-M0NSTER",
  description: "Eine interaktive CTF-Challenge zum Thema Web-Sicherheit",
};

// Root layout for the application.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <header className="site-header">
          <div className="container">
            <nav className="nav"></nav>
          </div>
        </header>

        <main className="container">{children}</main>

        <footer className="site-footer">
          <div className="container">
            <small>© {new Date().getFullYear()} c00kie-m0nster CTF</small>
          </div>
        </footer>
        <BotButton />
      </body>
    </html>
  );
}
