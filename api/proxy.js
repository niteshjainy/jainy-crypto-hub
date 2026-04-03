export default async function handler(req, res) {
    try {
        const { path, ...params } = req.query;

        if (!path) {
            return res.status(400).json({ error: "Missing path" });
        }

        const query = new URLSearchParams(params).toString();

        // ✅ SAME AS LOCAL (V4)
        const url = `https://open-api-v4.coinglass.com${path}?${query}`;

        const response = await fetch(url, {
            headers: {
                "CG-API-KEY": process.env.COINGLASS_API_KEY,
            },
        });

        const text = await response.text();

        res.status(response.status).send(text);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}