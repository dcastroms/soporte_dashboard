const express = require("express");
const next = require("next");
const serverless = require("serverless-http");

let cachedHandler;

async function createHandler() {
  if (cachedHandler) return cachedHandler;

  const app = next({
    dev: false,
    conf: { compress: true },
  });

  await app.prepare();
  const handle = app.getRequestHandler();

  const server = express();
  server.disable("x-powered-by");
  server.set("trust proxy", true);

  server.use((req, res) => handle(req, res));

  cachedHandler = serverless(server, {
    binary: [
      "image/*",
      "font/*",
      "application/octet-stream",
      "application/wasm",
      "application/x-font-ttf",
      "application/vnd.ms-fontobject",
    ],
  });

  return cachedHandler;
}

module.exports.handler = async (event, context) => {
  const handler = await createHandler();
  return handler(event, context);
};
