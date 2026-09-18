import React, { useState } from 'react';
import newLogoImg from '../assets/new_logo.png';
import smallBagImg from '../assets/sm_pink_Sour Apple.jpg';
import mediumBagImg from '../assets/med_pink_Sour Apple.jpg';
import largeBagImg from '../assets/lg_pink_Sour Apple.jpg';

interface HomeScreenProps {
  onOpenBooking: (bagSize?: string) => void;
  onOpenOrders: () => void;
  onOpenPayment: () => void;
  onOpenContract: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onOpenBooking,
  onOpenOrders,
  onOpenPayment,
  onOpenContract,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMvccRate, setIsMvccRate] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');

  const pricing = {
    small: isMvccRate ? 10 : 20,
    medium: isMvccRate ? 20 : 30,
    large: isMvccRate ? 30 : 40,
  };

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-800 pb-24 font-sans max-w-md mx-auto shadow-2xl overflow-x-hidden">
      {/* 1. TOP HEADER */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-5 pt-4 pb-2">
        <span className="text-xs font-semibold text-slate-800">9:41</span>
        
        <div className="flex items-center gap-2">
          {/* Avatar with mascot face */}
          <button 
            onClick={() => setActiveTab('Account')}
            className="w-10 h-10 rounded-full border-2 border-emerald-500 overflow-hidden shadow-md bg-white flex items-center justify-center"
            aria-label="Account Profile"
          >
            <img 
              src={newLogoImg} 
              alt="Mascot Avatar" 
              className="w-full h-full object-cover object-left scale-150"
            />
          </button>

          {/* Hamburger Menu (3 lines) */}
          <button 
            onClick={() => setMenuOpen(true)}
            className="w-10 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-slate-800 shadow-md hover:bg-white transition"
            aria-label="Open Navigation Menu"
          >
            <div className="flex flex-col gap-1 w-4">
              <span className="block h-0.5 w-full bg-slate-800 rounded-full"></span>
              <span className="block h-0.5 w-full bg-slate-800 rounded-full"></span>
              <span className="block h-0.5 w-full bg-slate-800 rounded-full"></span>
            </div>
          </button>
        </div>
      </header>

      {/* 2. SLIDE-OUT MENU DRAWER */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm" 
            onClick={() => setMenuOpen(false)}
          />
          <div className="relative ml-auto w-72 bg-white h-full shadow-2xl p-6 flex flex-col justify-between z-10">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <span className="font-bold text-emerald-800 text-lg">Sour Apple Menu</span>
                <button onClick={() => setMenuOpen(false)} className="text-slate-400 hover:text-slate-700 text-lg font-bold">✕</button>
              </div>

              <nav className="mt-6 flex flex-col gap-3">
                <button onClick={() => { setMenuOpen(false); onOpenBooking(); }} className="text-left font-medium text-slate-700 hover:text-emerald-600 py-2 border-b border-slate-50">
                  📅 Book a Pickup
                </button>
                <button onClick={() => { setMenuOpen(false); onOpenOrders(); }} className="text-left font-medium text-slate-700 hover:text-emerald-600 py-2 border-b border-slate-50">
                  🧺 My Orders & Tracking
                </button>
                <button onClick={() => { setMenuOpen(false); setIsMvccRate(!isMvccRate); }} className="text-left font-medium text-slate-700 hover:text-emerald-600 py-2 border-b border-slate-50">
                  🎓 MVCC Student Rates ({isMvccRate ? 'Active' : 'Enable'})
                </button>
                <button onClick={() => { setMenuOpen(false); onOpenPayment(); }} className="text-left font-medium text-slate-700 hover:text-emerald-600 py-2 border-b border-slate-50">
                  💵 Payment Methods (Cash App / Venmo)
                </button>
                <button onClick={() => { setMenuOpen(false); onOpenContract(); }} className="text-left font-medium text-slate-700 hover:text-emerald-600 py-2 border-b border-slate-50">
                  📝 Service Contract & Terms
                </button>
              </nav>
            </div>

            <div className="text-xs text-slate-400 text-center pb-2">
              Sour Apple Wash & Fold • South Utica, NY
            </div>
          </div>
        </div>
      )}

      {/* 3. HERO BANNER */}
      <section className="relative pt-20 px-5 pb-8 bg-gradient-to-b from-emerald-100/70 via-white to-slate-50">
        <div className="relative z-10 pt-4 flex flex-col items-start">
          <img 
            src={newLogoImg} 
            alt="Sour Apple Wash & Fold" 
            className="w-56 h-auto drop-shadow-xl mb-3"
          />

          <h1 className="text-4xl font-extrabold text-emerald-600 tracking-tight leading-tight font-serif italic">
            Laundry <br /> Made Easy!
          </h1>

          <p className="text-xs text-slate-600 mt-2 font-medium">
            Book, pay, and relax. We'll handle the rest!
          </p>

          <button 
            onClick={() => onOpenBooking()}
            className="mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-500 text-white font-bold px-5 py-2.5 rounded-full shadow-lg shadow-emerald-600/30 hover:scale-[1.02] active:scale-95 transition text-sm"
          >
            <span>📅</span>
            <span>Book a Pickup</span>
            <span>&gt;</span>
          </button>
        </div>
      </section>

      {/* 4. FOUR QUICK ACTION CARDS */}
      <section className="px-4 -mt-3 relative z-20">
        <div className="grid grid-cols-4 gap-2 bg-white/90 backdrop-blur rounded-2xl p-3 shadow-md border border-slate-100">
          <button onClick={() => onOpenBooking()} className="flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 text-base shadow-sm">📅</div>
            <span className="text-xs font-bold mt-1 text-slate-800">Book</span>
            <span className="text-[9px] text-slate-400">Choose time</span>
          </button>

          <button onClick={() => onOpenPayment()} className="flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 text-base shadow-sm">💳</div>
            <span className="text-xs font-bold mt-1 text-slate-800">Pay</span>
            <span className="text-[9px] text-slate-400">Secure & easy</span>
          </button>

          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 text-base shadow-sm">🧼</div>
            <span className="text-xs font-bold mt-1 text-slate-800">We Wash</span>
            <span className="text-[9px] text-slate-400">Fresh & clean</span>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 text-base shadow-sm">👕</div>
            <span className="text-xs font-bold mt-1 text-slate-800">We Fold</span>
            <span className="text-[9px] text-slate-400">Ready for you</span>
          </div>
        </div>
      </section>

      {/* 5. "OUR SERVICES" & 3 SIZED BAGS */}
      <section className="px-4 mt-6">
        <div className="inline-block bg-emerald-600 text-white font-bold italic text-sm px-4 py-1 rounded-r-full shadow-sm mb-4">
          Our Services
        </div>

        <div className="grid grid-cols-3 gap-2.5 items-end">
          {/* Small Bag (Scaled smallest: h-20) */}
          <div 
            onClick={() => onOpenBooking('Small')}
            className="bg-white rounded-2xl p-2.5 shadow-md border border-slate-100 flex flex-col items-center cursor-pointer hover:border-emerald-300 transition"
          >
            <div className="h-24 flex items-center justify-center">
              <img src={smallBagImg} alt="Small Bag" className="max-h-20 w-auto object-contain drop-shadow-md" />
            </div>
            <span className="text-xs font-bold text-slate-800 mt-2">Small Bag</span>
            <span className="text-base font-extrabold text-emerald-600">${pricing.small}</span>
            <span className="text-[9px] text-slate-400">(approx. 1 load)</span>
          </div>

          {/* Medium Bag (Medium height: h-28) */}
          <div 
            onClick={() => onOpenBooking('Medium')}
            className="bg-white rounded-2xl p-2.5 shadow-md border border-slate-100 flex flex-col items-center cursor-pointer hover:border-emerald-300 transition"
          >
            <div className="h-28 flex items-center justify-center">
              <img src={mediumBagImg} alt="Medium Bag" className="max-h-28 w-auto object-contain drop-shadow-md" />
            </div>
            <span className="text-xs font-bold text-slate-800 mt-2">Medium Bag</span>
            <span className="text-base font-extrabold text-emerald-600">${pricing.medium}</span>
            <span className="text-[9px] text-slate-400">(approx. 1.5 loads)</span>
          </div>

          {/* Large Bag (Scaled largest: h-36) */}
          <div 
            onClick={() => onOpenBooking('Large')}
            className="bg-white rounded-2xl p-2.5 shadow-md border border-slate-100 flex flex-col items-center cursor-pointer hover:border-emerald-300 transition"
          >
            <div className="h-36 flex items-center justify-center">
              <img src={largeBagImg} alt="Large Bag" className="max-h-36 w-auto object-contain drop-shadow-md" />
            </div>
            <span className="text-xs font-bold text-slate-800 mt-2">Large Bag</span>
            <span className="text-base font-extrabold text-emerald-600">${pricing.large}</span>
            <span className="text-[9px] text-slate-400">(approx. 2 loads)</span>
          </div>
        </div>

        {/* 6. MVCC PRICING BANNER */}
        <div 
          onClick={() => setIsMvccRate(!isMvccRate)}
          className="mt-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between cursor-pointer hover:bg-emerald-100/70 transition shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white text-lg shadow-sm">🎓</div>
            <div>
              <div className="text-xs font-bold text-slate-900">MVCC Student, Faculty & Staff Pricing &gt;</div>
              <div className="text-[10px] text-slate-500">{isMvccRate ? 'Active: $10 off per bag!' : 'Show your MVCC ID and get exclusive rates!'}</div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-emerald-700 italic block font-serif">Support<br />Local! ♡</span>
          </div>
        </div>
      </section>

      {/* 7. BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur border-t border-slate-100 px-6 py-2.5 flex items-center justify-between z-40 shadow-lg">
        <button onClick={() => setActiveTab('Home')} className="flex flex-col items-center text-emerald-600">
          <span className="text-lg">🏠</span>
          <span className="text-[10px] font-bold mt-0.5">Home</span>
          <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full mt-0.5"></span>
        </button>

        <button onClick={() => { setActiveTab('Bookings'); onOpenOrders(); }} className="flex flex-col items-center text-slate-400 hover:text-slate-600">
          <span className="text-lg">📅</span>
          <span className="text-[10px] font-medium mt-0.5">Bookings</span>
        </button>

        <button onClick={() => { setActiveTab('Services'); onOpenBooking(); }} className="flex flex-col items-center text-slate-400 hover:text-slate-600">
          <span className="text-lg">🏷️</span>
          <span className="text-[10px] font-medium mt-0.5">Services</span>
        </button>

        <button onClick={() => onOpenOrders()} className="flex flex-col items-center text-slate-400 hover:text-slate-600">
          <span className="text-lg">🔔</span>
          <span className="text-[10px] font-medium mt-0.5">Notifications</span>
        </button>

        <button onClick={() => onOpenPayment()} className="flex flex-col items-center text-slate-400 hover:text-slate-600">
          <span className="text-lg">👤</span>
          <span className="text-[10px] font-medium mt-0.5">Account</span>
        </button>
      </nav>
    </div>
  );
};
