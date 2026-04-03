export default async function handler(req, res) {
    console.log("✅ PROXY HIT");

    try {
        const { path = "", ...params } = req.query;

        // 🔥 Build query string
        const query = new URLSearchParams(params).toString();

        // ✅ USE V4 API (same as local)
        const url = `https://open-api-v4.coinglass.com${path}?${query}`;

        console.log("URL:", url);

        const response = await fetch(url, {
            headers: {
                "CG-API-KEY": process.env.COINGLASS_API_KEY,
            },
        });

        const text = await response.text();

        console.log("STATUS:", response.status);
        console.log("RESPONSE:", text);

        res.status(response.status).send(text);
    } catch (err) {
        console.error("❌ PROXY ERROR:", err);
        res.status(500).json({ error: "Proxy failed" });
    }
}