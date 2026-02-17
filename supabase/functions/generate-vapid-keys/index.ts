import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://playqre.netlify.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Check if keys already exist in environment
    const existingPublic = Deno.env.get("VAPID_PUBLIC_KEY");

    if (existingPublic) {
      return new Response(
        JSON.stringify({ publicKey: existingPublic }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.error("VAPID_PUBLIC_KEY is not configured in Supabase secrets");
    return new Response(
      JSON.stringify({ error: "Push service public key not configured" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
