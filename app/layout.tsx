import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ITRI Exhibition Visitor Request",
  description: "ITRI FOUP Type EUV Dose Wafer Meter visitor request form",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
