import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { searchChunks, formatContext } from "@/lib/retrieval/search";
import { condenseQuery, expandQuery, getAnswer } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 60;

// Discord Interaction Types
const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
};

// Discord Interaction Response Types
const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
};

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin || "https://rohith-rag.vercel.app";
  const interactionsUrl = `${origin}/api/discord`;

  return NextResponse.json({
    service: "Web-RAG Discord Bot Integration",
    status: "ready",
    interactionsEndpoint: interactionsUrl,
    instructions: [
      "1. Go to Discord Developer Portal (https://discord.com/developers/applications).",
      "2. Select or create your Application.",
      `3. Set 'Interactions Endpoint URL' to: ${interactionsUrl}`,
      "4. Create a slash command named '/ask' with an option 'question' (String, Required).",
      "5. Invite the bot to your Discord server with 'bot' and 'applications.commands' scopes.",
    ],
    sampleSlashCommand: {
      name: "ask",
      description: "Ask a question and receive answers verified by your indexed websites",
      options: [
        {
          name: "question",
          description: "What would you like to know?",
          type: 3, // String
          required: true,
        },
        {
          name: "site",
          description: "Specific bot/site name to target (optional)",
          type: 3, // String
          required: false,
        },
      ],
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Handle Discord Ping (Handshake validation)
    if (body.type === InteractionType.PING) {
      return NextResponse.json({ type: InteractionResponseType.PONG });
    }

    // 2. Handle Application Command (/ask)
    if (body.type === InteractionType.APPLICATION_COMMAND) {
      const { data } = body;
      const options = data.options || [];
      const questionOption = options.find((o: any) => o.name === "question");
      const siteOption = options.find((o: any) => o.name === "site");

      const question = questionOption?.value ? String(questionOption.value).trim() : "";
      const siteNameFilter = siteOption?.value ? String(siteOption.value).trim().toLowerCase() : null;

      if (!question) {
        return NextResponse.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: "⚠️ Please provide a question to ask!" },
        });
      }

      // Resolve site filter if provided
      let targetSiteId: string | null = null;
      let targetSiteName = "All Websites";

      if (siteNameFilter) {
        const sites = await prisma.site.findMany();
        const matched = sites.find(
          (s) =>
            s.id.toLowerCase() === siteNameFilter ||
            (s.name && s.name.toLowerCase().includes(siteNameFilter))
        );
        if (matched) {
          targetSiteId = matched.id;
          targetSiteName = matched.name || "Target Site";
        }
      }

      // Execute decoupled RAG retrieval
      const standaloneQuery = await condenseQuery(question, []);
      const expandedQuery = await expandQuery(standaloneQuery);
      const chunks = await searchChunks(targetSiteId, standaloneQuery, 5, 10000, expandedQuery);

      if (chunks.length === 0) {
        return NextResponse.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `🔍 **[${targetSiteName}]** I couldn't find any verified information on that in the indexed pages.`,
          },
        });
      }

      const context = formatContext(chunks);
      const rawAnswer = await getAnswer(question, context, null, []);
      const cleanAnswer = rawAnswer.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();

      // Format sources list for Discord markdown
      const seenUrls = new Set<string>();
      const sourceLinks: string[] = [];
      for (const c of chunks) {
        if (c.pageUrl && !seenUrls.has(c.pageUrl)) {
          seenUrls.add(c.pageUrl);
          let label = (c.heading || "").trim();
          if (!label || label.length < 3) {
            try {
              const u = new URL(c.pageUrl);
              label = u.hostname.replace(/^www\./, "");
            } catch {
              label = c.pageUrl.slice(0, 30);
            }
          }
          sourceLinks.push(`• [${label}](${c.pageUrl})`);
          if (sourceLinks.length >= 3) break;
        }
      }

      const sourcesBlock = sourceLinks.length > 0 ? `\n\n📖 **Sources:**\n${sourceLinks.join("\n")}` : "";
      const discordResponse = `> **Q: ${question}**\n*Target: ${targetSiteName}*\n\n${cleanAnswer}${sourcesBlock}`;

      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: discordResponse.slice(0, 2000), // Discord max message length is 2000
        },
      });
    }

    return NextResponse.json({ error: "Unsupported interaction type" }, { status: 400 });
  } catch (error: any) {
    console.error("[discord webhook error]:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
