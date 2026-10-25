// Inlines engine.js into page.html -> dist/nse-terminal.html (the published artifact).
const fs = require("fs"), path = require("path");
const here = __dirname;
const page = fs.readFileSync(path.join(here, "page.html"), "utf8");
const engine = fs.readFileSync(path.join(here, "engine.js"), "utf8");
fs.mkdirSync(path.join(here, "dist"), { recursive: true });
fs.writeFileSync(path.join(here, "dist", "nse-terminal.html"), page.replace("/*ENGINE*/", () => engine));
console.log("built dist/nse-terminal.html");
