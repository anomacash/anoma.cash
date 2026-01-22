// /api/bip39.js

/* -----------------------------------------------------
   STARPAY API HANDLER 
----------------------------------------------------- */
export default async function handler(req, res) {
  try {
    const { mode } = req.query;

    /* -----------------------------
       CREATE STARPAY ORDER
    ----------------------------- */
    if (mode === "starpayCreate") {
      const { amount, cardType, email } = req.body;

      if (!amount || !cardType || !email) {
        return res.status(400).json({
          ok: false,
          error: "Missing fields"
        });
      }

      const r = await fetch(
        "https://www.starpay.cards/api/v1/cards/order",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.STARPAY_API_KEY}`
          },
          body: JSON.stringify({ amount, cardType, email })
        }
      );

      const data = await r.json();

      if (!r.ok) {
        return res.status(r.status).json({
          ok: false,
          error: data
        });
      }

      return res.json({
        ok: true,
        data
      });
    }

    /* -----------------------------
       STARPAY ORDER STATUS
    ----------------------------- */
    if (mode === "starpayStatus") {
      const { orderId } = req.query;

      if (!orderId) {
        return res.status(400).json({
          ok: false,
          error: "Missing orderId"
        });
      }

      const r = await fetch(
        `https://www.starpay.cards/api/v1/cards/order/status?orderId=${orderId}`,
        {
          headers: {
            "Authorization": `Bearer ${process.env.STARPAY_API_KEY}`
          }
        }
      );

      const data = await r.json();

      if (!r.ok) {
        return res.status(r.status).json({
          ok: false,
          error: data
        });
      }

      return res.json({
        ok: true,
        data
      });
    }
