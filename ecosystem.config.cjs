module.exports = {
  apps: [
    {
      name: "godex-ui-rewrite",
      script: "./apps/server/dist/index.js",
      cwd: "./apps/server",
      env: {
        SERVER_PORT: 7777,
        CODEX_RELAY_TOKEN: "zflipcommand",
        NODE_ENV: "production"
      }
    }
  ]
};
