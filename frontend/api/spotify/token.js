export default async function handler(req, res) {
  const code = req.query.code;
  console.log("Spotify token response:", data);

  if (!code) {
    return res.status(400).json({ error: "Missing code" });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return res.status(500).json({
      error: "Missing server env vars",
      missing: {
        SPOTIFY_CLIENT_ID: !clientId,
        SPOTIFY_CLIENT_SECRET: !clientSecret,
        SPOTIFY_REDIRECT_URI: !redirectUri
      }
    });
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret
  });

  try {
    const r = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    const data = await r.json();
    return res.status(r.ok ? 200 : r.status).json(data);
  } catch (e) {
    console.error("Spotify token exchange error:", e);
    return res.status(500).json({ error: "Token exchange failed" });
  }
}
