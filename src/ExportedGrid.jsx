import React, { useState, useEffect, useRef } from 'react';
import * as Lucide from 'lucide-react';

// Component 1
const Component0 = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const navLinks = [
    { name: 'Home', href: '#home' },
    { name: 'Features', href: '#features' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'Contact', href: '#contact' },
  ];

  return (
    <nav className="w-full bg-gradient-to-r from-purple-700 to-indigo-800 text-white shadow-xl z-50 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Lucide.Sparkle className="h-8 w-8 mr-2 text-yellow-300" />
            <span className="text-2xl font-bold tracking-wider">Acme Inc.</span>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-purple-600 transition-colors duration-200"
                >
                  {link.name}
                </a>
              ))}
            </div>
          </div>

          {/* Right Section / Desktop Actions */}
          <div className="hidden md:flex items-center">
            <button className="bg-indigo-700 hover:bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center">
              <Lucide.LogIn className="h-4 w-4 mr-2" />
              Sign In
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="-mr-2 flex md:hidden">
            <button
              onClick={toggleMenu}
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-200 hover:text-white hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-purple-800 focus:ring-white transition-colors duration-200"
              aria-controls="mobile-menu"
              aria-expanded={isOpen}
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? (
                <Lucide.X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Lucide.Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {isOpen && (
        <div className="md:hidden bg-purple-800 absolute w-full left-0 shadow-lg" id="mobile-menu">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-gray-200 hover:bg-purple-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200"
                onClick={toggleMenu}
              >
                {link.name}
              </a>
            ))}
            <button className="w-full text-left bg-indigo-700 hover:bg-indigo-600 text-white px-3 py-2 rounded-md text-base font-medium mt-1 transition-colors duration-200 flex items-center justify-center">
              <Lucide.LogIn className="h-5 w-5 mr-2" />
              Sign In
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

// Component 2
const Component1 = () => (
  <div className="h-full w-full flex items-center justify-center p-4 bg-gradient-to-br from-green-50 to-blue-50 text-gray-800">
    <div className="max-w-md text-center bg-white p-8 rounded-lg shadow-xl border border-gray-100">
      <Lucide.Leaf className="w-16 h-16 text-green-600 mx-auto mb-4" />
      <h2 className="text-3xl font-bold mb-4 text-green-700">Embracing Sustainability</h2>
      <p className="text-lg leading-relaxed text-gray-700">
        Sustainability is about meeting the needs of the present without compromising the ability of future generations to meet their own needs. 
        It integrates environmental protection, social equity, and economic viability to foster long-term global well-being.
      </p>
      <p className="mt-4 text-sm text-gray-500">
        Let's build a better future, together.
      </p>
    </div>
  </div>
);

// Component 3
const Component2 = () => {
  return (
    <div className="h-full w-full flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 text-gray-800">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-2xl p-8 space-y-6 text-center border border-gray-200">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Lucide.Search className="h-14 w-14 text-blue-600 animate-pulse" />
          <h2 className="text-4xl font-extrabold text-gray-900 leading-tight">
            Suchit's Current Professional Journey
          </h2>
        </div>
        <p className="text-lg leading-relaxed text-gray-700">
          Suchit is currently in a transitional phase, actively exploring new and challenging career opportunities that align with their evolving expertise in full-stack development and cloud architecture.
        </p>
        <p className="text-md leading-relaxed text-gray-600 italic">
          Their previous role concluded due to a company-wide restructuring initiative, which led to the consolidation of several departments. Suchit is utilizing this period to deepen their skills in emerging technologies and is seeking a role where they can contribute to innovative projects and achieve significant professional growth.
        </p>
        <div className="flex items-center justify-center gap-4 pt-4">
          <button className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition duration-300 ease-in-out transform hover:scale-105">
            Connect on LinkedIn
          </button>
          <button className="px-8 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg shadow-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-opacity-75 transition duration-300 ease-in-out transform hover:scale-105">
            View Portfolio
          </button>
        </div>
      </div>
    </div>
  );
};


export default function ExportedGrid() {
  return (
    <div className="grid grid-cols-12 min-h-screen bg-gray-900">
      <div 
        style={{ 
          gridColumn: '1 / span 12',
          gridRow: '1 / span 1'
        }}
      >
        <Component0 />
      </div>
      <div 
        style={{ 
          gridColumn: '7 / span 6',
          gridRow: '2 / span 5'
        }}
      >
        <Component1 />
      </div>
      <div 
        style={{ 
          gridColumn: '1 / span 6',
          gridRow: '2 / span 5'
        }}
      >
        <Component2 />
      </div>
    </div>
  );
}
