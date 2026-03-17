import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface RegionAnalysis {
  hasData: boolean;
  hotTopics: {
    title: string;
    description: string;
    heat: number;
    sentiment: "positive" | "negative";
  }[];
  sentiment: { positive: number; neutral: number; negative: number };
  positiveTrends: string[];
  negativeTrends: string[];
  weeklySummary: string;
}

export interface TrendAnalysis {
  gameTitle: string;
  gameImageUrl: string;
  korea: RegionAnalysis;
  global: RegionAnalysis;
  sources: { title: string; uri: string }[];
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10분
const SAME_QUERY_COOLDOWN_MS = 10 * 1000; // 10초

const resultCache = new Map<string, { data: TrendAnalysis; timestamp: number }>();
const pendingRequests = new Map<string, Promise<TrendAnalysis>>();
const lastRequestAt = new Map<string, number>();

function normalizeGameName(gameName: string): string {
  return gameName.trim().toLowerCase();
}

export async function analyzeGameTrends(gameName: string): Promise<TrendAnalysis> {
  const normalized = normalizeGameName(gameName);

  if (!normalized) {
    throw new Error("게임명을 입력해주세요.");
  }

  const now = Date.now();

  // 1) 캐시가 남아 있으면 재사용
  const cached = resultCache.get(normalized);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // 2) 같은 요청이 이미 진행 중이면 기존 요청 재사용
  const pending = pendingRequests.get(normalized);
  if (pending) {
    return pending;
  }

  // 3) 같은 검색어를 너무 짧은 시간 안에 다시 요청하는 경우 차단
  const lastAt = lastRequestAt.get(normalized);
  if (lastAt && now - lastAt < SAME_QUERY_COOLDOWN_MS) {
    if (cached) {
      return cached.data;
    }
    throw new Error("같은 게임 분석을 너무 빠르게 다시 요청하고 있습니다. 잠시 후 다시 시도해주세요.");
  }

  lastRequestAt.set(normalized, now);

  const requestPromise = (async (): Promise<TrendAnalysis> => {
    const currentDate = new Date().toISOString().split("T")[0];

    const prompt = `
      Analyze the current user trends for the game "${gameName}" by comprehensively investigating both Korea and Global regions, STRICTLY focusing on the LAST 7 DAYS (from approximately ${currentDate} backwards).
      
      Data Sources to Analyze:
      1. Korea Region: 
         - Official: Game's official Korean website, official forums, and Naver Lounge.
         - Community: DC Inside (디시인사이드 갤러리), Inven (인벤), Ruliweb (루리웹), ArcaLive (아카라이브), and YouTube comments.
      2. Global Region: 
         - Official: Game's official global website, official forums (e.g., Blizzard forums, Hoyolab), and official X (Twitter)/Facebook.
         - Community: Reddit (r/${gameName}), Steam Community Hub, Discord, and YouTube comments.

      Analysis Requirements:
      - FOCUS: Only include events, updates, patches, or controversies that occurred in the LAST 7 DAYS. Avoid general game descriptions or long-term sentiment.
      - Do NOT rely on just one or two sources. Synthesize information from ALL mentioned platforms to provide a holistic insight.
      - If a region has no active community or data available, set "hasData" to false for that region.
      - IMAGE: Find a DIRECT high-quality representative image URL (illustration, key art, or title screen) for the game. 
        - PREFER: Direct links from official sites, Steam (header.jpg), or IGDB. 
        - AVOID: Page URLs or search result URLs. The URL MUST end with an image extension like .jpg, .png, or .webp.

      For each region (if hasData is true):
      - Hot Topics: 3-5 most discussed issues or events that occurred in the LAST 7 DAYS.
        - IMPORTANT: Titles and descriptions for GLOBAL hot topics must also be written in KOREAN.
        - For each topic, provide a "heat" value (0-100, representing temperature/intensity).
        - For each topic, categorize its "sentiment" as either "positive" or "negative".
      - Sentiment: Estimated percentage of positive, neutral, and negative sentiment based ONLY on discussions from the LAST 7 DAYS.
      - Positive Trends: What specific recent things are players happy about?
      - Negative Trends: What specific recent things are players complaining about?
      - Weekly Summary: A concise summary of the overall mood and key events of THIS SPECIFIC WEEK.

      IMPORTANT: 
      - ALL output (titles, descriptions, summaries, trends) must be written in KOREAN.
      - Provide the official or most common name of the game in "gameTitle".
      - Provide the found image URL in "gameImageUrl".
      - Return the data in a structured JSON format with "gameTitle", "gameImageUrl", "korea", and "global" keys.
    `;

    const regionSchema = {
      type: Type.OBJECT,
      properties: {
        hasData: { type: Type.BOOLEAN, description: "Whether data was found for this region" },
        hotTopics: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              heat: { type: Type.NUMBER, description: "Intensity value from 0 to 100" },
              sentiment: { type: Type.STRING, enum: ["positive", "negative"] }
            },
            required: ["title", "description", "heat", "sentiment"]
          }
        },
        sentiment: {
          type: Type.OBJECT,
          properties: {
            positive: { type: Type.NUMBER },
            neutral: { type: Type.NUMBER },
            negative: { type: Type.NUMBER }
          },
          required: ["positive", "neutral", "negative"]
        },
        positiveTrends: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        negativeTrends: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        weeklySummary: { type: Type.STRING }
      },
      required: ["hasData", "hotTopics", "sentiment", "positiveTrends", "negativeTrends", "weeklySummary"]
    };

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            gameTitle: { type: Type.STRING },
            gameImageUrl: { type: Type.STRING },
            korea: regionSchema,
            global: regionSchema
          },
          required: ["gameTitle", "gameImageUrl", "korea", "global"]
        }
      },
    });

    const text = response.text || "{}";
    const data = JSON.parse(text);

    const sources =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk) => ({
        title: chunk.web?.title || "Source",
        uri: chunk.web?.uri || "#"
      })) || [];

    const result: TrendAnalysis = {
      ...data,
      sources
    };

    resultCache.set(normalized, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  })();

  pendingRequests.set(normalized, requestPromise);

  try {
    return await requestPromise;
  } finally {
    pendingRequests.delete(normalized);
  }
}
