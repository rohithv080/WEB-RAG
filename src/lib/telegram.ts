import { prisma } from "@/lib/db";

export async function syncTelegramBotCommands(): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  try {
    const sites = await prisma.site.findMany();
    const commands = [
      { command: "sites", description: "Choose a website bot" },
      { command: "language", description: "Change AI Response Language" },
      { command: "all", description: "Search all websites" },
      ...sites.map((s) => ({
        command: (s.name || s.id)
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/[^a-z0-9_]/g, "")
          .slice(0, 32),
        description: `Search ${(s.name || s.id).slice(0, 50)}`,
      })),
    ];

    const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands }),
    });

    return res.ok;
  } catch (err) {
    console.error("[telegram] syncTelegramBotCommands error:", err);
    return false;
  }
}
