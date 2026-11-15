import { defineConfig } from "vite";
const proxy = {
  "/api": process.env.CORE_AURA_API_PROXY || "http://127.0.0.1:8793",
  "/packs/uploads": process.env.CORE_AURA_API_PROXY || "http://127.0.0.1:8793",
};
export default defineConfig({
  server: { proxy },
  preview: { host: "127.0.0.1", port: 8089, proxy },
});
