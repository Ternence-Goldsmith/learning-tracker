import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Encrypted Learning Tracker | FHEVM Privacy DApp",
  description: "FHEVM-based DApp for encrypted learning achievement tracking with full privacy protection",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="fixed inset-0 w-full h-full zama-bg z-[-20]"></div>
        <div className="fixed inset-0 w-full h-full z-[-19] opacity-20 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-20 w-96 h-96 rounded-full bg-[var(--primary-blue)] blur-[150px] animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-[var(--primary-gold)] blur-[150px] animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-r from-[var(--primary-blue)] to-[var(--primary-gold)] blur-[200px] opacity-10 animate-pulse" style={{ animationDelay: '0.5s' }}></div>
        </div>
        <main className="flex flex-col max-w-7xl mx-auto pb-8 px-4 min-h-screen">
          <nav className="flex w-full h-fit py-8 justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--primary-blue)] to-[var(--primary-gold)] flex items-center justify-center glow-effect animate-float">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-7 h-7 text-black">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold title-gradient">Encrypted Learning Tracker</h1>
                <p className="text-sm text-gray-400 mt-1">Privacy-First Education on FHEVM</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-[var(--primary-blue)]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <span className="text-sm text-gray-300">Fully Encrypted</span>
            </div>
          </nav>
          <div className="flex-1">
            <Providers>{children}</Providers>
          </div>
          <footer className="mt-12 pt-8 border-t border-[var(--card-border)]">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-center md:text-left">
                <p className="text-gray-400 text-sm">
                  Powered by <span className="text-[var(--primary-blue)] font-semibold">Zama FHEVM</span>
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  All learning data is encrypted end-to-end on the blockchain
                </p>
              </div>
              <div className="flex gap-4 items-center">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-gray-400">Privacy Protected</span>
                </div>
                <div className="h-4 w-px bg-[var(--card-border)]"></div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full bg-[var(--primary-gold)] animate-pulse"></div>
                  <span className="text-gray-400">Blockchain Verified</span>
                </div>
              </div>
            </div>
          </footer>
        </main>
      </body>
    </html>
  );
}

