import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

export const metadata: Metadata = {
  title: "Victorious Memory",
  description: "AI Memory & Knowledge Graph System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
        />
      </head>
      <body className="bg-[#13131b] text-[#e4e1ed] min-h-screen font-sans antialiased overflow-x-hidden">
        <Sidebar />
        <div className="ml-[260px] min-h-screen flex flex-col">
          <TopBar />
          <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

