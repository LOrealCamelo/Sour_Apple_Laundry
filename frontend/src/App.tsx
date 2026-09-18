import React, { useState } from 'react';
import { HomeScreen } from './components/HomeScreen';
import { BookingModal } from './components/BookingModal';
import { OrdersModal } from './components/OrdersModal';
import { PaymentModal } from './components/PaymentModal';

export const App: React.FC = () => {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedBagSize, setSelectedBagSize] = useState<string | undefined>();
  const [activeOrder, setActiveOrder] = useState<any>(null);

  return (
    <div className="bg-slate-100 min-h-screen">
      <HomeScreen 
        onOpenBooking={(size) => { setSelectedBagSize(size); setBookingOpen(true); }}
        onOpenOrders={() => setOrdersOpen(true)}
        onOpenPayment={() => setPaymentOpen(true)}
        onOpenContract={() => alert("Sour Apple VIP Service Terms: 48-72h turnaround, bag closure required, $100 per bag standard liability limit.")}
      />

      {bookingOpen && (
        <BookingModal 
          initialBagSize={selectedBagSize}
          onClose={() => setBookingOpen(false)}
          onSuccess={(order) => {
            setBookingOpen(false);
            setActiveOrder(order);
            setOrdersOpen(true);
          }}
        />
      )}

      {ordersOpen && (
        <OrdersModal 
          activeOrder={activeOrder}
          onClose={() => setOrdersOpen(false)}
          onOpenPayment={() => { setOrdersOpen(false); setPaymentOpen(true); }}
        />
      )}

      {paymentOpen && (
        <PaymentModal 
          onClose={() => setPaymentOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
