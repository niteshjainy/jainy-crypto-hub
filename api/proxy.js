export default async function handler(req, res) {
    try {
        const response = await fetch("https://api.binance.com/api/v3/time");
        const data = await response.json();

        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}