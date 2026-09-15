import { prisma } from "@/lib/db";

export async function syncTelegramBotCommands(): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  try {
    const sites = await prisma.site.findMany();
    const baseCommands = [
      { command: "sites", description: "Choose a website bot" },
      { command: "all", description: "Search all websites" },
      { command: "language", description: "Change AI response language" },
      { command: "status", description: "Check active bot & language" },
      { command: "clear", description: "Start a fresh chat session" },
      { command: "help", description: "Bot instructions & commands" },
    ];

    const used = new Set(baseCommands.map((c) => c.command));
    const siteCommands: { command: string; description: string }[] = [];

    for (const s of sites) {
      let cmd = (s.name || s.id)
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "")
        .slice(0, 32);

      // Fallback for names in Tamil, Hindi, or emojis where ASCII regex strips all characters
      if (!cmd || used.has(cmd)) {
        cmd = `site_${s.id.slice(-8)}`.toLowerCase();
      }

      if (!used.has(cmd)) {
        used.add(cmd);
        siteCommands.push({
          command: cmd,
          description: `Search ${(s.name || s.id).slice(0, 50)}`,
        });
      }
    }

    // Telegram setMyCommands allows max 100 commands
    const commands = [...baseCommands, ...siteCommands].slice(0, 100);

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
