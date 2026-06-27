import { useState, useEffect } from 'react';

export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollContainer, setScrollContainer] = useState(null);

  useEffect(() => {
    const handleScroll = (e) => {
      let target = e.target;
      
      // Si el evento viene del documento principal
      if (target === document) {
        target = document.documentElement;
      }
      
      if (target && target.scrollTop !== undefined) {
        if (target.scrollTop > 300) {
          setIsVisible(true);
          setScrollContainer(target);
        } else if (scrollContainer === target || !scrollContainer) {
          setIsVisible(false);
        }
      }
    };

    // Usamos el 'capture' (true) para interceptar el scroll de cualquier div interno (como los flex-1 overflow-y-auto)
    window.addEventListener('scroll', handleScroll, true);
    
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [scrollContainer]);

  const scrollToTop = () => {
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    } else {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-600/40 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 group animate-[fadeInUp_0.3s_ease-out]"
      title="Volver arriba"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor" className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
      </svg>
    </button>
  );
}
