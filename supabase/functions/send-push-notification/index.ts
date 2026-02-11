import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { sendNotification, deserializeVapidKeys } from "npm:web-push-browser@1.4.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { player_ids, title, body, icon, tag, data } = await req.json();

    if (!player_ids || !Array.isArray(player_ids) || player_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "player_ids array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prioritize environment variables, fallback to hardcoded if necessary for immediate testing
    // Note: In production, these should be set as Supabase secrets
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "pk_test_BdueEZF6Ij64tmw-7xM5k1wtfKbNqdaVw4326okRQZ0";
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "sk_test_W46H4ZfYgp6Hrj9oBn4jtFrtvQeKLsuzO1acZDbPjx0";

    const vapidKeys = await deserializeVapidKeys({ publicKey, privateKey });

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
      data: data || {},
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

        await sendNotification(pushSubscription, vapidKeys, {
          subject: "mailto:playq@example.com",
        }, new TextEncoder().encode(payload));

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
  } catch (error) {
    console.error("Send push error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
