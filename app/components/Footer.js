import React from 'react'

const Footer = () => {
    const currentYear = new Date().getFullYear();
  return (
    <footer className='bg-[#64afec] w-full fixed bottom-0 left-0 flex justify-center p-2 text-white'>
        Copyright {currentYear} Agent Finance. All Rights reserved.
    </footer>
  )
}

export default Footer