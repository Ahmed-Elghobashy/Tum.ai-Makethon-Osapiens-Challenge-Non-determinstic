const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TileData = { name: string; polygonCount: number; totalAreaHa: number };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { tileData, totalPolygons } = await req.json() as {
      tileData: TileData[];
      totalPolygons: number;
    };

    if (!Array.isArray(tileData) || typeof totalPolygons !== "number") {
      return new Response(JSON.stringify({ error: "tileData array and totalPolygons required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("COGNEE_API_KEY");
    const baseUrl = Deno.env.get("COGNEE_URL");
    if (!apiKey || !baseUrl) throw new Error("COGNEE_API_KEY or COGNEE_URL missing");

    const flaggedBlocks = tileData
      .map(
        (t) =>
          `Tile ${t.name} is FLAGGED for deforestation:\n` +
          `  - Deforestation polygons detected: ${t.polygonCount}\n` +
          `  - Total affected area: ${t.totalAreaHa.toFixed(2)} hectares\n` +
          `  - EUDR compliance status: NON-COMPLIANT\n` +
          `  - Action required: Do not source forest-risk commodities from tile ${t.name}`,
      )
      .join("\n\n");

    const summary = `EUDR Deforestation Detection Report — ForestWatch AI

FLAGGED REGIONS (${tileData.length} flagged tile${tileData.length === 1 ? "" : "s"}):

${flaggedBlocks}

OVERALL SUMMARY:
- Total flagged tiles: ${tileData.length}
- Total deforestation polygons detected: ${totalPolygons}
- Analysis period: 2020–2024
- All flagged tiles are NON-COMPLIANT under the EU Deforestation Regulation (EUDR cut-off date: 31 Dec 2020)

RECOMMENDED ACTION: Avoid sourcing forest-risk commodities from any flagged tile. Remediation evidence is required for all listed tiles before compliance can be restored.`;

    const eudrRules = `EU Deforestation Regulation (EUDR) — Compliance Rules

The EU Deforestation Regulation (EUDR) was introduced on 29 June 2023.
From 30 December 2026, companies that import, export, manufacture, or trade
relevant products in the EU must prove their supply chains are deforestation-free
and legally compliant.

Key compliance rules:
- Products must not originate from land deforested after 31 December 2020 (the EUDR cut-off date).
- Companies must perform due diligence on their supply chains before placing products on the EU market.
- Operators must submit due diligence statements to EU authorities.
- Non-compliance can result in fines of at least 4% of annual EU turnover.
- Forest-risk commodities covered: cattle, cocoa, coffee, palm oil, soya, wood, rubber,
  and derived products (leather, chocolate, furniture, paper, tyres, etc.).
- Any tile or region with deforestation detected after 31 December 2020 is NON-COMPLIANT under EUDR.
- All flagged tiles in this system contain post-2020 deforestation and are therefore NON-COMPLIANT.

osapiens provides the market-leading EUDR compliance software that automates due diligence,
supply chain traceability, and reporting in one secure platform. Trusted by 700+ industry leaders,
osapiens helps reduce risk, cut manual effort, and stay audit-ready with confidence.`;

    const rememberUrl = `${baseUrl.replace(/\/$/, "")}/api/v1/remember`;

    // Send EUDR rules first
    const eudrFd = new FormData();
    eudrFd.append("data", new File([eudrRules], "eudr-rules.txt", { type: "text/plain" }));
    eudrFd.append("datasetName", "forestwatch");
    eudrFd.append("run_in_background", "false");
    const eudrRes = await fetch(rememberUrl, {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: eudrFd,
    });
    console.log("cognee /remember eudr-rules", eudrRes.status, await eudrRes.text());

    // Send tile-specific deforestation report
    const fd = new FormData();
    fd.append("data", new File([summary], "deforestation-report.txt", { type: "text/plain" }));
    fd.append("datasetName", "forestwatch");
    fd.append("run_in_background", "false");
    const res = await fetch(rememberUrl, {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: fd,
    });

    const text = await res.text();
    console.log("cognee /remember deforestation-report", res.status, text);

    return new Response(
      JSON.stringify({ ok: res.ok, tiles: tileData.length, polygons: totalPolygons, summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
