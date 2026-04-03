export default async function handler(req, res) {
    try {
        let { path, ...params } = req.query;

        if (!path) {
            return res.status(400).json({ error: "Missing path" });
        }

        if (!path.startsWith("/")) {
            path = "/" + path;
        }

        const query = new URLSearchParams(params).toString();

        const url = `https://open-api.coinglass.com/api/pro/v1${path}?${query}`;

        const response = await fetch(url, {
            headers: {
                "CG-API-KEY": process.env.COINGLASS_API_KEY,
            },
        });

        const data = await response.text();

        res.status(response.status).send(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}