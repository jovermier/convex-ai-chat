module.exports = {
  apps: [
    {
      name: "frontend",
      script: "pnpm",
      args: "dev:frontend",
      watch: false, // Vite has its own hot reload
      env: {
        NODE_ENV: "development",
      },
    },
    {
      name: "convex-env-sync",
      script: "./scripts/watch-convex-env.sh",
      interpreter: "/bin/bash",
      watch: false, // Script uses inotifywait internally
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 4000,
    },
    {
      name: "convex-code-sync",
      script: "./scripts/watch-convex-code.sh",
      interpreter: "/bin/bash",
      watch: false, // Script uses inotifywait internally
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 4000,
    },
  ],
}
