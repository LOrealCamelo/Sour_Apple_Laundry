import React, { useState } from 'react';

const BookingModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {

  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({

    bagSize: 'Small',

    isMVCC: false,

    signature: ''

  });

  if (!isOpen) return null;

  const calculatePrice = () => {

    const base = { Small: 20, Medium: 30, Large: 40 }[formData.bagSize] || 0;

|---|formData.isMVCC ? base - 10 : base;

  };

  return (

    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center">

      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-8 max-h-[90vh] overflow-y-auto">

        <h2 className="text-2xl font-black mb-6">Schedule Pickup</h2>

        

        <div className="space-y-6">

          <section>

            <label className="block text-sm font-bold text-gray-700 mb-3">Select Bag Size</label>

            <div className="grid grid-cols-3 gap-3">

              {['Small', 'Medium', 'Large'].map(size => (

                <button 

                  key={size}

                  onClick={() => setFormData({...formData, bagSize: size})}

                  className={`py-3 rounded-xl border-2 transition-all ${formData.bagSize === size ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 text-gray-500'}`}

                >

                  {size}

                </button>

              ))}

            </div>

          </section>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">

            <div>

              <p className="font-bold">MVCC Student Discount</p>

              <p className="text-xs text-gray-500">Must show ID at pickup</p>

            </div>

            <input 

              type="checkbox" 

              checked={formData.isMVCC}

              onChange={(e) => setFormData({...formData, isMVCC: e.target.checked})}

              className="w-6 h-6 accent-green-600" 

            />

          </div>

          <div className="border-t pt-6">

            <div className="flex justify-between items-center mb-4">

              <span className="text-gray-600">Total Estimate</span>

              <span className="text-2xl font-black text-green-600">${calculatePrice()}</span>

            </div>

          </div>

          <div className="bg-yellow-50 p-4 rounded-xl text-xs text-yellow-800 leading-relaxed">

            By signing below, you agree to the Sour Apple Laundry Service Agreement. We are not responsible for items left in pockets or color bleeding.

          </div>

          <input 

            type="text" 

            placeholder="Type Full Name to Sign"

            className="w-full border-b-2 border-gray-200 py-2 focus:border-green-500 outline-none"

            value={formData.signature}

            onChange={(e) => setFormData({...formData, signature: e.target.value})}

          />

          <button 

            className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-green-200"

            onClick={onClose}

          >

            Confirm & Book

          </button>

          

          <button className="w-full text-gray-400 font-medium py-2" onClick={onClose}>Cancel</button>

        </div>

      </div>

    </div>

  );

};

export default BookingModal;
