import React, { useState } from 'react';

import { Menu, User, ShoppingBag, Clock, CreditCard, HelpCircle, ChevronRight, Home, List, Bell, Settings } from 'lucide-react';

const HomeScreen = ({ onBookClick }: { onBookClick: () => void }) => {

  const [isDrawerOpen, setDrawerOpen] = useState(false);

  return (

    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900 font-sans">

      {/* Status Bar Spacer */}

      <div className="h-6 bg-white w-full"></div>

      {/* Header */}

      <header className="flex items-center justify-between px-6 py-4 bg-white shadow-sm">

        <button onClick={() => setDrawerOpen(true)}>

          <Menu className="w-6 h-6 text-gray-700" />

        </button>

        <div className="flex items-center gap-2">

          <img src="/apple-mascot.png" alt="Mascot" className="w-10 h-10 rounded-full border-2 border-green-100" />

        </div>

      </header>

      {/* Hero Section */}

      <div className="px-6 py-8">

        <div className="bg-gradient-to-br from-green-400 to-green-600 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">

          <div className="relative z-10">

            <h1 className="text-3xl font-bold mb-2">Sour Apple Laundry</h1>

            <p className="text-green-50 opacity-90 mb-6">Freshness delivered to your door.</p>

            <button 

              onClick={onBookClick}

              className="bg-white text-green-600 px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-green-50 transition-colors"

            >

              Book a Pickup <ChevronRight className="w-4 h-4" />

            </button>

          </div>

          <img src="/logo-white.png" className="absolute -right-4 -bottom-4 w-32 opacity-20" alt="" />

        </div>

      </div>

      {/* Action Cards */}

      <div className="grid grid-cols-2 gap-4 px-6 mb-8">

        {[

          { icon: <ShoppingBag />, label: 'Active Orders', color: 'bg-blue-50 text-blue-600' },

          { icon: <Clock />, label: 'History', color: 'bg-purple-50 text-purple-600' },

          { icon: <CreditCard />, label: 'Payments', color: 'bg-orange-50 text-orange-600' },

          { icon: <HelpCircle />, label: 'Support', color: 'bg-green-50 text-green-600' }

        ].map((item, i) => (

          <div key={i} className={`${item.color} p-4 rounded-2xl flex flex-col items-center justify-center gap-2 font-medium shadow-sm`}>

            {item.icon}

            <span className="text-sm">{item.label}</span>

          </div>

        ))}

      </div>

      {/* Services Section */}

      <div className="px-6 pb-24">

        <h2 className="text-xl font-bold mb-4">Our Services</h2>

        

        <div className="bg-green-100 border border-green-200 rounded-xl p-4 mb-6 flex items-center justify-between">

          <span className="font-bold text-green-800">MVCC Student?</span>

          <span className="bg-green-600 text-white text-xs px-3 py-1 rounded-full">Save $10 on every bag</span>

        </div>

        <div className="space-y-4">

          {[

            { size: 'Small', price: '$20', img: 'sm_pink_Sour Apple.jpg' },

            { size: 'Medium', price: '$30', img: 'med_pink_Sour Apple.jpg' },

            { size: 'Large', price: '$40', img: 'lg_pink_Sour Apple.jpg' }

          ].map((bag) => (

            <div key={bag.size} className="bg-white p-4 rounded-2xl flex items-center gap-4 shadow-sm border border-gray-100">

              <img src={`/${bag.img}`} alt={bag.size} className="w-20 h-20 object-cover rounded-xl" />

              <div className="flex-1">

                <h3 className="font-bold text-lg">{bag.size} Bag</h3>

                <p className="text-gray-500 text-sm">Perfect for {bag.size === 'Small' ? 'singles' : bag.size === 'Medium' ? 'couples' : 'families'}.</p>

              </div>

              <div className="text-xl font-black text-green-600">{bag.price}</div>

            </div>

          ))}

        </div>

      </div>

      {/* Navigation Bar */}

      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 px-8 py-4 flex justify-between items-center z-50">

        <Home className="w-6 h-6 text-green-600" />

        <List className="w-6 h-6 text-gray-400" />

        <Bell className="w-6 h-6 text-gray-400" />

        <Settings className="w-6 h-6 text-gray-400" />

      </nav>

      {/* Drawer Overlay */}

      {isDrawerOpen && (

        <div className="fixed inset-0 bg-black/50 z-[60]" onClick={() => setDrawerOpen(false)}>

          <div className="w-64 h-full bg-white p-6" onClick={e => e.stopPropagation()}>

            <div className="flex items-center gap-3 mb-8">

              <img src="/apple-mascot.png" className="w-12 h-12 rounded-full" alt="" />

              <div>

                <p className="font-bold">Guest User</p>

                <p className="text-xs text-gray-500">View Profile</p>

              </div>

            </div>

            <ul className="space-y-6">

              <li className="flex items-center gap-3 font-medium text-gray-700"><Home className="w-5 h-5"/> Home</li>

              <li className="flex items-center gap-3 font-medium text-gray-700"><ShoppingBag className="w-5 h-5"/> My Orders</li>

              <li className="flex items-center gap-3 font-medium text-gray-700"><CreditCard className="w-5 h-5"/> Wallet</li>

              <li className="flex items-center gap-3 font-medium text-gray-700"><HelpCircle className="w-5 h-5"/> Help & FAQ</li>

            </ul>

          </div>

        </div>

      )}

    </div>

  );

};

export default HomeScreen;
