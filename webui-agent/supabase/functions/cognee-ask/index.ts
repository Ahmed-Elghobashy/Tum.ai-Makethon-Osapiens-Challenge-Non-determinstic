const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { question } = await req.json();
    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "question required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("COGNEE_API_KEY");
    const baseUrl = Deno.env.get("COGNEE_URL");
    if (!apiKey || !baseUrl) throw new Error("COGNEE_API_KEY or COGNEE_URL missing");

    const url = `${baseUrl.replace(/\/$/, "")}/api/v1/search`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: question,
        search_type: "CHUNKS",
      }),
    });

    const text = await res.text();
    console.log("cognee response:", text);

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Cognee error: ${text}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse and extract clean answer
    let answer = "No information found.";
    try {
      const data = JSON.parse(text);

      const extractResults = (item: unknown): string[] => {
        if (!item || typeof item !== "object") return [];
        const sr = (item as Record<string, unknown>).search_result;
        if (Array.isArray(sr)) return sr.filter((r) => typeof r === "string" && r.trim());
        if (typeof sr === "string" && sr.trim()) return [sr];
        return [];
      };

      const results = Array.isArray(data)
        ? data.flatMap(extractResults)
        : extractResults(data);

      answer = results.length > 0 ? results.join("\n\n") : "No information available for this query.";
    } catch {
      answer = "No information available for this query.";
    }

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
