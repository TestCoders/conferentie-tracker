import type { Metadata } from 'next';
import { JetBrains_Mono, Open_Sans, Poppins } from 'next/font/google';
import { SiteHeader } from '@/components/site/SiteHeader';
import './globals.css';

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['600', '700'],
});

const openSans = Open_Sans({
  variable: '--font-open-sans',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Conference Tracker',
  description: 'Conferenties voor development, testen en testautomatisering',
};

// Zet het thema vóór de eerste paint: opgeslagen keuze, anders systeemvoorkeur.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t!=="dark"&&t!=="light")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="nl"
      data-theme="light"
      suppressHydrationWarning
      className={`${poppins.variable} ${openSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
