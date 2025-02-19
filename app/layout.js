import { Public_Sans } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import Header from './components/Header';
import Footer from './components/Footer';
import { NavigationProvider } from './context/NavigationContext';
import './globals.css';

const publicSans = Public_Sans({ 
  subsets: ['latin'],
  variable: '--font-public-sans',
});

export const metadata = {
  title: 'Excel Template Mapping',
  description: 'Map fields between Excel files',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${publicSans.variable} overflow-x-hidden`}>
      <body className="min-h-screen flex flex-col bg-gray-100 overflow-x-hidden scrollbar-hide">
        <Toaster position="top-right" />
        <NavigationProvider>
          <Header/>
          {children}
          <Footer/>
        </NavigationProvider>
      </body>
    </html>
  );
}
