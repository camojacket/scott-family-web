// "use client";
// import React, { useEffect, useRef, useState } from 'react';

// interface SquarePaymentProps {
//   applicationId: string;
//   locationId: string;
//   onPaymentSuccess: (paymentResult: any) => void;
//   onPaymentError: (error: any) => void;
// }

// export const SquarePayment: React.FC<SquarePaymentProps> = ({
//   applicationId,
//   locationId,
//   onPaymentSuccess,
//   onPaymentError,
// }) => {
//   const paymentsRef = useRef<any>(null);
//   const cardRef = useRef<any>(null);
//   const [isLoaded, setIsLoaded] = useState(false);

//   useEffect(() => {
//     const loadSquare = async () => {
//       try {
//         const payments = (window as any).Square?.payments(applicationId, locationId);
//         if (!payments) throw new Error("Square payments SDK failed to load.");
//         paymentsRef.current = payments;

//         const card = await payments.card();
//         await card.attach('#card-container');
//         cardRef.current = card;

//         setIsLoaded(true);
//       } catch (error) {
//         console.error('Square Init Error:', error);
//         onPaymentError(error);
//       }
//     };

//     const script = document.createElement('script');
//     script.src = 'https://sandbox.web.squarecdn.com/v1/square.js';
//     script.async = true;
//     script.onload = loadSquare;
//     document.body.appendChild(script);

//     return () => {
//       document.body.removeChild(script);
//     };
//   }, [applicationId, locationId, onPaymentError]);

//   const handlePayment = async () => {
//     try {
//       const tokenResult = await cardRef.current?.tokenize();
//       if (tokenResult.status !== 'OK') {
//         throw new Error('Failed to tokenize card.');
//       }

//       // Send this to your server to process the payment with Square API
//       const response = await fetch('/api/process-payment', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ sourceId: tokenResult.token }),
//       });

//       const result = await response.json();
//       if (result.success) {
//         onPaymentSuccess(result);
//       } else {
//         throw new Error(result.message || 'Payment processing failed');
//       }
//     } catch (error) {
//       console.error('Payment error:', error);
//       onPaymentError(error);
//     }
//   };

//   return (
//     <div>
//       <div id="card-container" className="my-4" />
//       <button
//         disabled={!isLoaded}
//         onClick={handlePayment}
//         className="px-4 py-2 bg-blue-600 text-white rounded"
//       >
//         Pay Now
//       </button>
//     </div>
//   );
// };
