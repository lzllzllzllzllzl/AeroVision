import express from "express";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy for Doubao API using OpenAI SDK
  app.post("/api/predict-price", async (req, res) => {
    try {
      const { prompt } = req.body;
      const apiKey = process.env.DOUBAO_API_KEY || "baeac3bb-34b5-4033-bba4-b9defd1113cb"; 
      
      const client = new OpenAI({
        apiKey: apiKey,
        baseURL: "https://ark.cn-beijing.volces.com/api/v3",
      });

      const response = await client.chat.completions.create({
        model: "doubao-seed-1-6-251015",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      res.json(response);
    } catch (error: any) {
      console.error("Doubao API Error:", error);
      res.status(500).json({ 
        error: "Failed to fetch prediction", 
        details: error.message,
        mock: true 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
