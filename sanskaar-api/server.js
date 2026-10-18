/* Local server: same API as the deployed one, with an embedded database kept in ./.data
   npm run dev   (reads keys from .env) */
const http = require("http");

process.env.PGLITE_DIR ??= require("path").join(__dirname, ".data");
const api = require("./api/index");
const port = Number(process.env.PORT) || 3001;

http.createServer(api).listen(port, () => console.log(`SANSKAAR API on http://localhost:${port}`));
