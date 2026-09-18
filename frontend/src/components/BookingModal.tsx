import React, { useState } from 'react';
import { api } from '../services/api';

interface BookingModalProps {
  initialBagSize?: string;
  onClose: () => void;
  onSuccess: (order: any) => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({ initialBagSize, onClose, onSuccess }) => {
  const [customerType, setCustomerType] = useState('College Student');
  const [college, setCollege] = useState('MVCC');
  const [dorm, setDorm] = useState('');
  const [bags, setBags] = useState(1);
  const [bagSize, setBagSize] = useState(initialBagSize || 'Small');
  const [rush, setRush] = useState(false);
  const [beddingAddon, setBeddingAddon] = useState(false);
  const [stainNotes, setStainNotes] = useState('');
  const [contractAgreed, setContractAgreed] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sizing calculation
  const baseRate = customerType === 'College Student' 
    ? (bagSize === 'Small' ? 10 : bagSize === 'Medium' ? 20 : 30)
    : (bagSize === 'Small' ? 20 : bagSize === 'Medium' ? 30 : 40);

  const estimatedTotal = (baseRate * bags) + (rush ? 20 : 0) + (beddingAddon ? 25 : 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractAgreed || !signatureName.trim()) {
      setError('You must accept the terms and type your legal name to sign.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        customer_type: customerType,
        college: customerType === 'College Student' ? college : '',
        dorm: customerType === 'College Student' ? dorm : '',
        service_type: 'Wash & Fold',
        services: ['Wash & Fold'],
        bags,
        rush,
        bedding_addon: beddingAddon,
        stain_notes: stainNotes,
        contract_agreed: true,
        signature_name: signatureName,
        signed_at: new Date().toISOString(),
      };

      const order = await api.createOrder(payload);
      onSuccess(order);
    } catch (err: any) {
      setError(err.message || 'Failed to submit booking request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl my-8 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-xl font-bold">✕</button>

        <h2 className="text-xl font-bold text-slate-900 mb-1">Book a Pickup</h2>
        <p className="text-xs text-slate-500 mb-4">Sour Apple Wash & Fold • South Utica & MVCC</p>

        {error && <div className="mb-3 p-2 bg-red-50 text-red-600 text-xs rounded-xl border border-red-200">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Type */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Customer Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCustomerType('College Student')}
                className={`py-2 text-xs font-bold rounded-xl border ${customerType === 'College Student' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
              >
                🎓 MVCC Student / Staff
              </button>
              <button
                type="button"
                onClick={() => setCustomerType('Non-Student')}
                className={`py-2 text-xs font-bold rounded-xl border ${customerType === 'Non-Student' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
              >
                🏡 Local Drop-Off
              </button>
            </div>
          </div>

          {customerType === 'College Student' && (
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Dorm / Campus Location</label>
              <input
                type="text"
                value={dorm}
                onChange={(e) => setDorm(e.target.value)}
                placeholder="e.g. Bellamy Hall, Room 204"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                required
              />
            </div>
          )}

          {/* Bag Size */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Bag Size</label>
            <div className="grid grid-cols-3 gap-2">
              {['Small', 'Medium', 'Large'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setBagSize(s)}
                  className={`py-2 text-xs font-bold rounded-xl border ${bagSize === s ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Add-ons */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
              <span>⚡ Same-Day Rush (+$20)</span>
              <input type="checkbox" checked={rush} onChange={(e) => setRush(e.target.checked)} className="rounded text-emerald-600" />
            </label>
            <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
              <span>🛏️ Bedding / Comforter (+$25)</span>
              <input type="checkbox" checked={beddingAddon} onChange={(e) => setBeddingAddon(e.target.checked)} className="rounded text-emerald-600" />
            </label>
          </div>

          {/* Digital Contract */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <span className="text-[11px] font-bold text-slate-800 block">Digital Service Agreement</span>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Standard 48-72h turnaround. Closed bags required (drawstring/zipper). Liability up to $100 per bag. Unclaimed laundry donated after 30 days.
            </p>
            <label className="flex items-start gap-2 text-[10px] text-slate-700 cursor-pointer">
              <input type="checkbox" checked={contractAgreed} onChange={(e) => setContractAgreed(e.target.checked)} className="mt-0.5 text-emerald-600 rounded" />
              <span>I accept the Sour Apple VIP Service Agreement.</span>
            </label>
            <input
              type="text"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder="Type full legal name to sign"
              className="w-full text-xs p-2 bg-white border border-slate-200 rounded-xl outline-none"
              required
            />
          </div>

          {/* Estimated Total & Submit */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Estimated Total</span>
              <span className="text-xl font-extrabold text-emerald-600">${estimatedTotal}</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 text-white font-bold text-xs px-5 py-2.5 rounded-full shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Confirm Booking >'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
