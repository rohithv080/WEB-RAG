"use client";

import { create } from "zustand";
import type { SiteSummary } from "@/components/BotCard";
import type { DrawerTab } from "@/components/RightInspectorDrawer";
import type { Citation } from "@/components/CitationCard";

export type View = "home" | "chat";

interface AppState {
  // Navigation & Active Bot
  view: View;
  selectedSite: SiteSummary | null;
  sessionId: string | null;
  chatKey: number;
  sidebarCollapsed: boolean;

  // Drawer / Inspector
  drawerOpen: boolean;
  drawerTab: DrawerTab;

  // Modals & Panels
  showAddBotModal: boolean;
  showEmbedModal: boolean;
  embedSite: SiteSummary | null;
  showSettingsModal: boolean;
  settingsSite: SiteSummary | null;
  showAnalyticsModal: boolean;
  analyticsSite: SiteSummary | null;
  showApiKeysModal: boolean;
  commandPaletteOpen: boolean;
  inspectingCitation: { citation: Citation; query?: string } | null;

  // Sites & Admin
  sites: SiteSummary[];
  sitesLoading: boolean;
  isAdmin: boolean;
  adminScope: "user" | "all";

  // Language Preferences
  selectedLanguage: string;
  setSelectedLanguage: (lang: string) => void;

  // Actions
  setView: (view: View) => void;
  setSelectedSite: (site: SiteSummary | null) => void;
  setSessionId: (id: string | null) => void;
  incrementChatKey: () => void;
  setSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  toggleSidebar: () => void;

  // Drawer Actions
  setDrawerOpen: (open: boolean) => void;
  setDrawerTab: (tab: DrawerTab) => void;
  toggleDrawer: (tab: DrawerTab) => void;
  closeDrawer: () => void;

  // Navigation Flows
  openChat: (site: SiteSummary, initialSessionId?: string | null) => void;
  startNewChat: () => void;
  switchSession: (sessionId: string) => void;
  goHome: () => void;

  // Modal Actions
  openAddBot: () => void;
  closeAddBot: () => void;
  openEmbed: (site: SiteSummary) => void;
  closeEmbed: () => void;
  openSettings: (site: SiteSummary) => void;
  closeSettings: () => void;
  openAnalytics: (site: SiteSummary) => void;
  closeAnalytics: () => void;
  setShowApiKeysModal: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setInspectingCitation: (data: { citation: Citation; query?: string } | null) => void;

  // Sites Data Actions
  setSites: (sites: SiteSummary[] | ((prev: SiteSummary[]) => SiteSummary[])) => void;
  setSitesLoading: (loading: boolean) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  setAdminScope: (scope: "user" | "all") => void;
  updateSiteInList: (updatedSite: SiteSummary) => void;
  removeSiteFromList: (siteId: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial State
  view: "home",
  selectedSite: null,
  sessionId: null,
  chatKey: 0,
  sidebarCollapsed: false,

  drawerOpen: false,
  drawerTab: "pages",

  showAddBotModal: false,
  showEmbedModal: false,
  embedSite: null,
  showSettingsModal: false,
  settingsSite: null,
  showAnalyticsModal: false,
  analyticsSite: null,
  showApiKeysModal: false,
  commandPaletteOpen: false,
  inspectingCitation: null,

  sites: [],
  sitesLoading: true,
  isAdmin: false,
  adminScope: "user",

  selectedLanguage: typeof window !== "undefined" ? (localStorage.getItem("web_rag_language") || "auto") : "auto",
  setSelectedLanguage: (selectedLanguage) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("web_rag_language", selectedLanguage);
      } catch {}
    }
    set({ selectedLanguage });
  },

  // Simple Setters
  setView: (view) => set({ view }),
  setSelectedSite: (selectedSite) => set({ selectedSite }),
  setSessionId: (sessionId) => set({ sessionId }),
  incrementChatKey: () => set((s) => ({ chatKey: s.chatKey + 1 })),
  setSidebarCollapsed: (arg) =>
    set((s) => ({
      sidebarCollapsed: typeof arg === "function" ? arg(s.sidebarCollapsed) : arg,
    })),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  // Drawer Controls
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  setDrawerTab: (drawerTab) => set({ drawerTab }),
  toggleDrawer: (tab) =>
    set((s) => {
      if (s.drawerOpen && s.drawerTab === tab) {
        return { drawerOpen: false };
      }
      return { drawerOpen: true, drawerTab: tab };
    }),
  closeDrawer: () => set({ drawerOpen: false }),

  // High-Level Navigation
  openChat: (site, initialSessionId) =>
    set((s) => ({
      view: "chat",
      selectedSite: site,
      sessionId: initialSessionId !== undefined ? initialSessionId : (site.latestSessionId ?? null),
      chatKey: s.chatKey + 1,
      drawerOpen: false,
    })),

  startNewChat: () =>
    set((s) => ({
      sessionId: null,
      chatKey: s.chatKey + 1,
    })),

  switchSession: (sessionId) =>
    set((s) => ({
      sessionId,
      chatKey: s.chatKey + 1,
    })),

  goHome: () =>
    set({
      view: "home",
      selectedSite: null,
      sessionId: null,
      drawerOpen: false,
    }),

  // Modals
  openAddBot: () => set({ showAddBotModal: true }),
  closeAddBot: () => set({ showAddBotModal: false }),

  openEmbed: (site) => set({ embedSite: site, showEmbedModal: true }),
  closeEmbed: () => set({ showEmbedModal: false, embedSite: null }),

  openSettings: (site) => set({ settingsSite: site, showSettingsModal: true }),
  closeSettings: () => set({ showSettingsModal: false, settingsSite: null }),

  openAnalytics: (site) => set({ analyticsSite: site, showAnalyticsModal: true }),
  closeAnalytics: () => set({ showAnalyticsModal: false, analyticsSite: null }),

  setShowApiKeysModal: (open) => set({ showApiKeysModal: open }),
  setCommandPaletteOpen: (arg) =>
    set((s) => ({
      commandPaletteOpen: typeof arg === "function" ? arg(s.commandPaletteOpen) : arg,
    })),

  setInspectingCitation: (inspectingCitation) => set({ inspectingCitation }),

  // Sites Collections
  setSites: (arg) =>
    set((s) => ({
      sites: typeof arg === "function" ? arg(s.sites) : arg,
    })),
  setSitesLoading: (sitesLoading) => set({ sitesLoading }),
  setIsAdmin: (isAdmin) => set({ isAdmin }),
  setAdminScope: (adminScope) => set({ adminScope }),

  updateSiteInList: (updatedSite) =>
    set((s) => {
      const nextSites = s.sites.map((st) => (st.id === updatedSite.id ? updatedSite : st));
      return {
        sites: nextSites,
        selectedSite: s.selectedSite?.id === updatedSite.id ? updatedSite : s.selectedSite,
        settingsSite: s.settingsSite?.id === updatedSite.id ? updatedSite : s.settingsSite,
      };
    }),

  removeSiteFromList: (siteId) =>
    set((s) => {
      const nextSites = s.sites.filter((st) => st.id !== siteId);
      const isSelected = s.selectedSite?.id === siteId;
      return {
        sites: nextSites,
        selectedSite: isSelected ? null : s.selectedSite,
        view: isSelected ? "home" : s.view,
      };
    }),
}));
