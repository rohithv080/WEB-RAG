import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { EmbedChatView } from "./EmbedChatView";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const site = await prisma.site.findUnique({
    where: { id },
    select: { name: true },
  });

  return {
    title: site?.name ? `${site.name} — AI Assistant` : "AI Chatbot",
    description: "Embeddable website chatbot powered by Web RAG",
  };
}

export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ color?: string; title?: string; greeting?: string }>;
}) {
  const { id } = await params;
  const { color, title, greeting } = await searchParams;

  let site = await prisma.site.findUnique({
    where: { id },
    select: { id: true, name: true, description: true },
  });

  if (!site) {
    // Check if ID was passed as case-insensitive site name
    site = await prisma.site.findFirst({
      where: { name: { equals: id, mode: "insensitive" } },
      select: { id: true, name: true, description: true },
    });
  }

  if (!site) {
    notFound();
  }

  return (
    <EmbedChatView
      siteId={site.id}
      siteName={title || site.name || "AI Assistant"}
      description={site.description}
      accentColor={color || "#3d9cf0"}
      initialGreeting={greeting}
    />
  );
}
