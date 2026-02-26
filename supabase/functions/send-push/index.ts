import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@stewardship.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  user_id: string;
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  reminder_id?: string;
}

// Web Push requires JWT for VAPID authentication
async function createVapidJwt(endpoint: string): Promise<string> {
  const audience = new URL(endpoint).origin;
  const header = { alg: "ES256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: VAPID_SUBJECT,
  };

  const encoder = new TextEncoder();

  function base64url(data: Uint8Array): string {
    return btoa(String.fromCharCode(...data))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  const headerB64 = base64url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64url(encoder.encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;

  // Import private key
  const rawKey = Uint8Array.from(
    atob(VAPID_PRIVATE_KEY.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0)
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    rawKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(unsigned)
  );

  const signatureB64 = base64url(new Uint8Array(signature));
  return `${unsigned}.${signatureB64}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, title, body, url, tag, reminder_id } =
      (await req.json()) as PushPayload;

    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: "user_id and title required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check quiet hours
    const { data: settings } = await supabase
      .from("user_settings")
      .select("quiet_hours_start, quiet_hours_end")
      .eq("user_id", user_id)
      .maybeSingle();

    if (settings) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("timezone")
        .eq("id", user_id)
        .maybeSingle();

      const tz = profile?.timezone || "America/Chicago";
      const now = new Date();
      const hour = parseInt(
        now.toLocaleString("en-US", { timeZone: tz, hour: "numeric", hour12: false }),
        10
      );
      const [startH] = (settings.quiet_hours_start || "22:00").split(":").map(Number);
      const [endH] = (settings.quiet_hours_end || "07:00").split(":").map(Number);

      let inQuiet = false;
      if (startH > endH) {
        inQuiet = hour >= startH || hour < endH;
      } else {
        inQuiet = hour >= startH && hour < endH;
      }

      if (inQuiet) {
        return new Response(
          JSON.stringify({ status: "deferred", reason: "quiet_hours" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Frequency cap — check how many push notifications sent today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: todayCount } = await supabase
      .from("reminders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user_id)
      .eq("delivery_method", "push")
      .eq("status", "delivered")
      .gte("updated_at", todayStart.toISOString());

    if ((todayCount || 0) >= 5) {
      return new Response(
        JSON.stringify({ status: "deferred", reason: "frequency_cap" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get push subscriptions
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh_key, auth_key")
      .eq("user_id", user_id)
      .eq("is_active", true);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ status: "no_subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pushPayload = JSON.stringify({ title, body, url, tag, reminder_id });
    let sent = 0;
    const errors: string[] = [];

    for (const sub of subscriptions) {
      try {
        // VAPID JWT authentication — required by all push services in production
        const vapidJwt = await createVapidJwt(sub.endpoint);

        // NOTE: Web Push spec requires payload encryption using the subscriber's
        // p256dh and auth keys (RFC 8291 / aes128gcm). Without encryption, push
        // services will reject the payload with 400/403. Full implementation needs:
        //   1. ECDH key agreement with subscriber's p256dh key
        //   2. HKDF key derivation for content encryption key + nonce
        //   3. AES-128-GCM encryption of the payload
        // For production, use a Deno-compatible web-push library or implement
        // the encryption per RFC 8291. Until then, push delivery will fail for
        // most browsers (subscription and VAPID auth work correctly).
        const response = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
            TTL: "86400",
            Authorization: `vapid t=${vapidJwt}, k=${VAPID_PUBLIC_KEY}`,
          },
          body: new TextEncoder().encode(pushPayload),
        });

        if (response.status === 201 || response.status === 200) {
          sent++;
        } else if (response.status === 404 || response.status === 410) {
          // Subscription expired — remove it
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", user_id)
            .eq("endpoint", sub.endpoint);
          errors.push(`Removed expired subscription: ${sub.endpoint.substring(0, 50)}`);
        } else {
          errors.push(`Push failed (${response.status}): ${sub.endpoint.substring(0, 50)}`);
        }
      } catch (e) {
        errors.push(`Push error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Mark reminder as delivered if provided
    if (reminder_id) {
      await supabase
        .from("reminders")
        .update({ status: "delivered" })
        .eq("id", reminder_id)
        .eq("user_id", user_id);
    }

    return new Response(
      JSON.stringify({ status: "sent", sent, total: subscriptions.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
