'use client';

import React from 'react'
import Image from 'next/image'
import Logo from "@/public/logo.png"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useNavigation } from '../context/NavigationContext'

const Header = () => {
  const pathname = usePathname();
  const { handleNavigation } = useNavigation();
  const showHomeButton = ['/create', '/edu', '/business', '/multi', '/marketing'].includes(pathname);

  const handleHomeClick = (e) => {
    if (pathname === '/create') {
      e.preventDefault();
      handleNavigation('/', () => {
        // Check for any changes (files or mappings)
        const hasChanges = localStorage.getItem('hasChanges') === 'true';
        return hasChanges;
      });
    }
  };

  return (
    <header className="bg-white shadow-md">
      <div className="flex justify-between items-center px-4 py-2">
        <div className="w-40">
          <Link href="/" onClick={handleHomeClick}>
            <Image 
              src={Logo} 
              alt="Agent Finance Logo"
              priority
            />
          </Link>
        </div>
        {showHomeButton && (
          <div className='pr-5'>
            <button 
              onClick={handleHomeClick}
              className="bg-blue-400 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg transition-colors duration-200 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              Return to Home
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header