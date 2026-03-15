import "./globals.css";

export const metadata = {
  title: "Retirement Planning Calculator",
  description: "Financial education calculator",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}