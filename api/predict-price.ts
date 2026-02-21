import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from "openai";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { prompt } = req.body;
    const apiKey = process.env.ARK_API_KEY || process.env.DOUBAO_API_KEY;

    if (!apiKey) {
      throw new Error("Missing ARK_API_KEY environment variable");
    }

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

    res.status(200).json(response);
  } catch (error: any) {
    console.error("Doubao API Error:", error);
    res.status(500).json({ 
      error: "Failed to fetch prediction", 
      details: error.message || error.toString() 
    });
  }
}
