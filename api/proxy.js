export default async function handler(req, res) {
    console.log("✅ PROXY HIT");

    try {
        let { path, ...params } = req.query;

        if (!path) {
            return res.status(400).json({ error: "Missing path" });
        }

        if (!path.startsWith("/")) {
            path = "/" + path;
        }

        const query = new URLSearchParams(params).toString();

        // 🔥 FIXED URL
        const url = `https://open-api-v4.coinglass.com/api/pro/v1${path}?${query}`;

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
        console.error("❌ PROXY ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
}