module.exports = {
  apps: [
    {
      name: "godex",
      script: "./apps/server/dist/index.js",
      cwd: "./apps/server",
      env: {
        SERVER_PORT: 7777,
        CODEX_RELAY_TOKEN: "zflipcommand",
        NODE_ENV: "production"
      }
    },
    {
      name: "caddy",
      script: "caddy",
      args: "run --config P:\\software\\godex\\caddy\\Caddyfile",
      cwd: "P:\\software\\godex"
    }
  ]
};
