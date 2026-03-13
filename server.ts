import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { initSocketServer } from "./src/lib/socket-server";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const httpServer = createServer((req, res) => {
        const parsedUrl = parse(req.url ?? "/", true);
        handle(req, res, parsedUrl);
    });

    // Initialize Socket.IO on the same HTTP server
    const io = initSocketServer(httpServer);

    httpServer.listen(port, () => {
        console.log(`> Server ready on http://${hostname}:${port}`);
        console.log(`> Socket.IO listening at /api/socket`);
    });
});
