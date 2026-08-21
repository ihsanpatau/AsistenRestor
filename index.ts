import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

// ============================================================
// PENTING: MERCHANT_CODE dan API_KEY TIDAK BOLEH ditulis langsung
// di sini. Keduanya diambil dari Supabase Edge Function Secrets
// supaya tidak ikut ke GitHub / kelihatan publik.
//
// Cara set secret-nya: ikuti tutorial yang dikirim terpisah.
// ============================================================
const MERCHANT_CODE = Deno.env.get("DUITKU_MERCHANT_CODE") ?? "";
const API_KEY = Deno.env.get("DUITKU_API_KEY") ?? "";
const DUITKU_URL = Deno.env.get("DUITKU_URL") ?? "https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry";
const CALLBACK_URL = Deno.env.get("DUITKU_CALLBACK_URL") ?? "https://rjxhijozmznqvkxqbywr.supabase.co/functions/v1/duitku-callback";
const RETURN_URL = Deno.env.get("DUITKU_RETURN_URL") ?? "https://asistenrestoran.com/payment-success.html";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Jaga-jaga kalau secret belum di-set di Supabase, langsung kasih error
  // yang jelas daripada diam-diam gagal / pakai key kosong.
  if (!MERCHANT_CODE || !API_KEY) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "DUITKU_MERCHANT_CODE / DUITKU_API_KEY belum di-set sebagai secret di Supabase.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { orderId, amount, customerName, customerEmail, items, restaurantId } = await req.json();

    // Buat signature MD5: merchantCode + merchantOrderId + paymentAmount + apiKey
    const signatureString = `${MERCHANT_CODE}${orderId}${amount}${API_KEY}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureString);
    const hashBuffer = await crypto.subtle.digest("MD5", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    const payload = {
      merchantCode: MERCHANT_CODE,
      paymentAmount: amount,
      paymentMethod: "QRIS",
      merchantOrderId: orderId,
      productDetails: `Pesanan Restoran - ${items.length} item`,
      customerVaName: customerName,
      email: customerEmail,
      callbackUrl: CALLBACK_URL,
      returnUrl: RETURN_URL,
      signature: signature,
      expiryPeriod: 60,
      itemDetails: items.map((item: any) => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
    };

    const response = await fetch(DUITKU_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    // Simpan order ke Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    await supabase.from("orders").update({
      payment_reference: result.reference,
      payment_status: "pending",
      payment_url: result.paymentUrl,
    }).eq("id", orderId);

    return new Response(JSON.stringify({
      success: true,
      paymentUrl: result.paymentUrl,
      reference: result.reference,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
