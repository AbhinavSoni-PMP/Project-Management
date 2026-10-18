/* Local development server: same handlers as the deployed /api functions.
   npm run dev   (reads keys from .env) */
const http = require("http");

const routes = { "/api/orders": require("./api/orders"), "/api/verify": require("./api/verify") };
const port = Number(process.env.PORT) || 3001;

http.createServer((req, res) => {
  const handler = routes[req.url.split("?")[0]];
  if (!handler) { res.statusCode = 404; return res.end("Not found"); }
  handler(req, res);
}).listen(port, () => console.log(`SANSKAAR payments API on http://localhost:${port}`));
