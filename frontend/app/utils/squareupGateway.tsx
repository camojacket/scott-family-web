// // POST /api/process-payment
// import { Client, Environment } from 'square';

// const client = new Client({
//   environment: Environment.Sandbox,
//   accessToken: process.env.SQUARE_ACCESS_TOKEN!,
// });

// export async function processPayment(req, res) {
//   const { sourceId } = req.body;

//   try {
//     const { result } = await client.paymentsApi.createPayment({
//       sourceId,
//       idempotencyKey: crypto.randomUUID(),
//       amountMoney: {
//         amount: 1000, // $10.00
//         currency: 'USD',
//       },
//     });

//     res.json({ success: true, result });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// }
