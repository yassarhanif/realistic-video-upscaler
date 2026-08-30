import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Realistic Video & Image Upscaler",
  description:
    "Peningkatan resolusi video & gambar fotorealistik berkualitas tinggi berbasis Real-ESRGAN dan GFPGAN pada RunPod Serverless.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#09090b] text-[#fafafa] antialiased selection:bg-zinc-800 selection:text-white">
        <div className="relative min-h-screen flex flex-col justify-between overflow-x-hidden">
          {/* Subtle ambient gradient backdrop */}
          <div className="fixed inset-0 pointer-events-none z-0">
            <div className="absolute top-[-15%] left-[20%] w-[600px] h-[600px] bg-zinc-800/10 rounded-full blur-[140px]" />
            <div className="absolute bottom-[-10%] right-[15%] w-[500px] h-[500px] bg-zinc-700/10 rounded-full blur-[130px]" />
          </div>
          <div className="relative z-10 flex flex-col flex-1">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
