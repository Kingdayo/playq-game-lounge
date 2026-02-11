import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateVapidKeys, serializeVapidKeys } from "npm:web-push-browser@1.4.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if keys already exist in environment
    const existingPublic = Deno.env.get("VAPID_PUBLIC_KEY") || "BK05wU7meph8D_xwlcxbAgHGacOaS17kvHZJkpAgp2IDh0UNYfvHJf1VXlXy7FN53nniJrrDpH0c0I-9A3w7NdY";

    if (existingPublic) {
      return new Response(
        JSON.stringify({ publicKey: existingPublic }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate new keys (only if no environment variables AND no fallback set)
    const keys = await generateVapidKeys();
    const serialized = await serializeVapidKeys(keys);

    return new Response(
      JSON.stringify({
        publicKey: serialized.publicKey,
        privateKey: serialized.privateKey,
        message: "Save these keys as VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY secrets",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
