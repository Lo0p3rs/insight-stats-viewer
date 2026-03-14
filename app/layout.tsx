import './globals.css';

export const metadata = {
  title: 'Insight Stats',
  description: 'Event analytics and team trend views.',
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
