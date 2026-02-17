import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import webpush from "npm:web-push";

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
    const requestData = await req.json();
    const { player_ids, title, body, icon, tag, data, renotify, actions } = requestData;

    if (!player_ids || !Array.isArray(player_ids) || player_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "player_ids array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Note: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set in Supabase secrets
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!publicKey || !privateKey) {
      console.error("VAPID keys are not fully configured in Supabase secrets");
      return new Response(
        JSON.stringify({ error: "Push service configuration incomplete" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    webpush.setVapidDetails(
      "mailto:playq@example.com",
      publicKey,
      privateKey
    );

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all subscriptions for the target players
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("player_id", player_ids);

    if (error) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = JSON.stringify({
      title: title || "PlayQ",
      body: body || "",
      icon: icon || "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: tag || undefined,
      renotify: renotify || false,
      actions: actions || undefined,
      data: {
        ...(data || {}),
        supabaseUrl: Deno.env.get("SUPABASE_URL"),
        supabaseAnonKey: Deno.env.get("SUPABASE_ANON_KEY"),
      },
    });

    let sent = 0;
    let failed = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        // Include the specific player_id in the payload data for tracking
        const playerSpecificPayload = JSON.parse(payload);
        playerSpecificPayload.data.playerId = sub.player_id;

        await webpush.sendNotification(pushSubscription, JSON.stringify(playerSpecificPayload));
        sent++;
      } catch (err: any) {
        failed++;
        // If subscription is expired/invalid, mark for cleanup
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          expiredEndpoints.push(sub.endpoint);
        }
        console.error(`Push failed for ${sub.player_id}:`, err?.message || err);
      }
    }

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
    }

    return new Response(
      JSON.stringify({ sent, failed, cleaned: expiredEndpoints.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Send push error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
