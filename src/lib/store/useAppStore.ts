"use client";

import { create } from "zustand";
import type { SiteSummary } from "@/components/BotCard";
import type { DrawerTab } from "@/components/RightInspectorDrawer";
import type { Citation } from "@/components/CitationCard";

export type View = "home" | "chat";
export type ActiveModal = "settings" | "analytics" | "embed" | "keys" | "add" | null;

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
  hydrateNavigation: (sites: SiteSummary[]) => void;

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

function syncUrlAndStorage(opts: {
  view?: View;
  site?: SiteSummary | null;
  sessionId?: string | null;
  drawerOpen?: boolean;
  drawerTab?: DrawerTab;
  modal?: ActiveModal;
  replace?: boolean;
}) {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);

    const targetView = opts.view !== undefined ? opts.view : (url.searchParams.has("bot") ? "chat" : "home");
    const targetSite = opts.site !== undefined ? opts.site : null;
    const targetSession = opts.sessionId !== undefined ? opts.sessionId : url.searchParams.get("session");
    const targetDrawerOpen = opts.drawerOpen !== undefined ? opts.drawerOpen : url.searchParams.has("tab");
    const targetDrawerTab = opts.drawerTab || (url.searchParams.get("tab") as DrawerTab | null) || "pages";
    const targetModal = opts.modal !== undefined ? opts.modal : (url.searchParams.get("modal") as ActiveModal);

    if (targetView === "chat" && targetSite) {
      url.searchParams.set("bot", targetSite.id);
      if (targetSession) {
        url.searchParams.set("session", targetSession);
      } else {
        url.searchParams.delete("session");
      }
      if (targetDrawerOpen && targetDrawerTab) {
        url.searchParams.set("tab", targetDrawerTab);
      } else {
        url.searchParams.delete("tab");
      }

      try {
        localStorage.setItem("web_rag_view", "chat");
        localStorage.setItem("web_rag_active_bot_id", targetSite.id);
        localStorage.setItem("web_rag_selected_site", JSON.stringify(targetSite));
        if (targetSession) {
          localStorage.setItem("web_rag_session_id", targetSession);
        } else {
          localStorage.removeItem("web_rag_session_id");
        }
        localStorage.setItem("web_rag_drawer_open", targetDrawerOpen ? "true" : "false");
        localStorage.setItem("web_rag_drawer_tab", targetDrawerTab);
      } catch {}
    } else if (targetView === "home") {
      url.searchParams.delete("bot");
      url.searchParams.delete("session");
      url.searchParams.delete("tab");

      try {
        localStorage.setItem("web_rag_view", "home");
        localStorage.removeItem("web_rag_active_bot_id");
        localStorage.removeItem("web_rag_selected_site");
        localStorage.removeItem("web_rag_session_id");
        localStorage.removeItem("web_rag_drawer_open");
        localStorage.removeItem("web_rag_drawer_tab");
      } catch {}
    }

    if (targetModal) {
      url.searchParams.set("modal", targetModal);
    } else {
      url.searchParams.delete("modal");
    }

    const newUrl = url.pathname + (url.search ? url.search : "");
    const currentUrl = window.location.pathname + (window.location.search ? window.location.search : "");
    if (newUrl !== currentUrl) {
      if (opts.replace) {
        window.history.replaceState({ view: targetView, botId: targetSite?.id, sessionId: targetSession }, "", newUrl);
      } else {
        window.history.pushState({ view: targetView, botId: targetSite?.id, sessionId: targetSession }, "", newUrl);
      }
    }
  } catch (e) {
    console.error("Error syncing URL and storage:", e);
  }
}

function getInitialNavigationState() {
  if (typeof window === "undefined") {
    return {
      view: "home" as View,
      selectedSite: null as SiteSummary | null,
      sessionId: null as string | null,
      drawerOpen: false,
      drawerTab: "pages" as DrawerTab,
      showAddBotModal: false,
      showEmbedModal: false,
      showSettingsModal: false,
      showAnalyticsModal: false,
      showApiKeysModal: false,
    };
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const urlBotId = params.get("bot");
    const urlSessionId = params.get("session");
    const urlTab = params.get("tab") as DrawerTab | null;
    const urlModal = params.get("modal") as ActiveModal;

    const savedView = (localStorage.getItem("web_rag_view") as View) || (urlBotId ? "chat" : "home");
    const targetBotId = urlBotId || (savedView === "chat" ? localStorage.getItem("web_rag_active_bot_id") : null);
    const targetSessionId = urlSessionId !== null ? urlSessionId : (savedView === "chat" ? localStorage.getItem("web_rag_session_id") : null);

    let cachedSite: SiteSummary | null = null;
    const rawCachedSite = localStorage.getItem("web_rag_selected_site");
    if (rawCachedSite) {
      try {
        const parsed = JSON.parse(rawCachedSite);
        if (parsed && (!targetBotId || parsed.id === targetBotId)) {
          cachedSite = parsed;
        }
      } catch {}
    }

    if (targetBotId && (savedView === "chat" || urlBotId)) {
      return {
        view: "chat" as View,
        selectedSite: cachedSite,
        sessionId: targetSessionId || cachedSite?.latestSessionId || null,
        drawerOpen: Boolean(urlTab) || localStorage.getItem("web_rag_drawer_open") === "true",
        drawerTab: urlTab || (localStorage.getItem("web_rag_drawer_tab") as DrawerTab) || "pages",
        showAddBotModal: urlModal === "add",
        showEmbedModal: urlModal === "embed",
        showSettingsModal: urlModal === "settings",
        showAnalyticsModal: urlModal === "analytics",
        showApiKeysModal: urlModal === "keys",
      };
    }

    return {
      view: "home" as View,
      selectedSite: null as SiteSummary | null,
      sessionId: null as string | null,
      drawerOpen: false,
      drawerTab: "pages" as DrawerTab,
      showAddBotModal: urlModal === "add",
      showEmbedModal: urlModal === "embed",
      showSettingsModal: urlModal === "settings",
      showAnalyticsModal: urlModal === "analytics",
      showApiKeysModal: urlModal === "keys",
    };
  } catch (e) {
    console.error("Error reading initial navigation state:", e);
    return {
      view: "home" as View,
      selectedSite: null as SiteSummary | null,
      sessionId: null as string | null,
      drawerOpen: false,
      drawerTab: "pages" as DrawerTab,
      showAddBotModal: false,
      showEmbedModal: false,
      showSettingsModal: false,
      showAnalyticsModal: false,
      showApiKeysModal: false,
    };
  }
}

const initialNav = getInitialNavigationState();

export const useAppStore = create<AppState>((set, get) => ({
  // Initial State restored from URL & storage
  view: initialNav.view,
  selectedSite: initialNav.selectedSite,
  sessionId: initialNav.sessionId,
  chatKey: 0,
  sidebarCollapsed: false,

  drawerOpen: initialNav.drawerOpen,
  drawerTab: initialNav.drawerTab,

  showAddBotModal: initialNav.showAddBotModal,
  showEmbedModal: initialNav.showEmbedModal,
  embedSite: null,
  showSettingsModal: initialNav.showSettingsModal,
  settingsSite: null,
  showAnalyticsModal: initialNav.showAnalyticsModal,
  analyticsSite: null,
  showApiKeysModal: initialNav.showApiKeysModal,
  commandPaletteOpen: false,
  inspectingCitation: null,

  sites: [],
  sitesLoading: true,
  isAdmin: false,
  adminScope: "user",

  selectedLanguage:
    typeof window !== "undefined" ? localStorage.getItem("web_rag_language") || "auto" : "auto",
  setSelectedLanguage: (selectedLanguage) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("web_rag_language", selectedLanguage);
      } catch {}
    }
    set({ selectedLanguage });
  },

  // Simple Setters
  setView: (view) => {
    syncUrlAndStorage({ view });
    set({ view });
  },
  setSelectedSite: (selectedSite) => {
    syncUrlAndStorage({ site: selectedSite });
    set({ selectedSite });
  },
  setSessionId: (sessionId) => {
    syncUrlAndStorage({ sessionId });
    set({ sessionId });
  },
  incrementChatKey: () => set((s) => ({ chatKey: s.chatKey + 1 })),
  setSidebarCollapsed: (arg) =>
    set((s) => ({
      sidebarCollapsed: typeof arg === "function" ? arg(s.sidebarCollapsed) : arg,
    })),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  // Drawer Controls
  setDrawerOpen: (drawerOpen) => {
    const s = get();
    if (s.view === "chat" && s.selectedSite) {
      syncUrlAndStorage({ site: s.selectedSite, drawerOpen, drawerTab: s.drawerTab });
    }
    set({ drawerOpen });
  },
  setDrawerTab: (drawerTab) => {
    const s = get();
    if (s.view === "chat" && s.selectedSite) {
      syncUrlAndStorage({ site: s.selectedSite, drawerOpen: s.drawerOpen, drawerTab });
    }
    set({ drawerTab });
  },
  toggleDrawer: (tab) =>
    set((s) => {
      const isClosing = s.drawerOpen && s.drawerTab === tab;
      const nextOpen = !isClosing;
      const nextTab = tab;
      if (s.view === "chat" && s.selectedSite) {
        syncUrlAndStorage({ site: s.selectedSite, drawerOpen: nextOpen, drawerTab: nextTab });
      }
      return { drawerOpen: nextOpen, drawerTab: nextTab };
    }),
  closeDrawer: () => {
    const s = get();
    if (s.view === "chat" && s.selectedSite) {
      syncUrlAndStorage({ site: s.selectedSite, drawerOpen: false, drawerTab: s.drawerTab });
    }
    set({ drawerOpen: false });
  },

  // High-Level Navigation
  openChat: (site, initialSessionId) => {
    const sid = initialSessionId !== undefined ? initialSessionId : (site.latestSessionId ?? null);
    syncUrlAndStorage({ view: "chat", site, sessionId: sid, drawerOpen: false, drawerTab: "pages" });
    set((s) => ({
      view: "chat",
      selectedSite: site,
      sessionId: sid,
      chatKey: s.chatKey + 1,
      drawerOpen: false,
    }));
  },

  startNewChat: () => {
    const s = get();
    syncUrlAndStorage({ view: "chat", site: s.selectedSite, sessionId: null, drawerOpen: s.drawerOpen, drawerTab: s.drawerTab });
    set((st) => ({
      sessionId: null,
      chatKey: st.chatKey + 1,
    }));
  },

  switchSession: (sessionId) => {
    const s = get();
    syncUrlAndStorage({ view: "chat", site: s.selectedSite, sessionId, drawerOpen: s.drawerOpen, drawerTab: s.drawerTab });
    set((st) => ({
      sessionId,
      chatKey: st.chatKey + 1,
    }));
  },

  goHome: () => {
    syncUrlAndStorage({ view: "home", site: null, sessionId: null, drawerOpen: false });
    set({
      view: "home",
      selectedSite: null,
      sessionId: null,
      drawerOpen: false,
    });
  },

  hydrateNavigation: (sites) => {
    if (typeof window === "undefined" || sites.length === 0) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const urlBotId = params.get("bot");
      const urlSessionId = params.get("session");
      const urlTab = params.get("tab") as DrawerTab | null;
      const urlModal = params.get("modal") as ActiveModal;

      const savedView = (localStorage.getItem("web_rag_view") as View) || (urlBotId ? "chat" : "home");
      const targetBotId = urlBotId || (savedView === "chat" ? localStorage.getItem("web_rag_active_bot_id") : null);
      const targetSessionId = urlSessionId !== null ? urlSessionId : (savedView === "chat" ? localStorage.getItem("web_rag_session_id") : null);

      if (targetBotId && (savedView === "chat" || urlBotId)) {
        const matched = sites.find((s) => s.id === targetBotId);
        if (matched) {
          const activeSession = targetSessionId !== null && targetSessionId !== undefined ? targetSessionId : (matched.latestSessionId ?? null);
          set({
            view: "chat",
            selectedSite: matched,
            sessionId: activeSession,
            drawerOpen: Boolean(urlTab),
            drawerTab: urlTab || "pages",
            showSettingsModal: urlModal === "settings",
            settingsSite: urlModal === "settings" ? matched : null,
            showAnalyticsModal: urlModal === "analytics",
            analyticsSite: urlModal === "analytics" ? matched : null,
            showEmbedModal: urlModal === "embed",
            embedSite: urlModal === "embed" ? matched : null,
            showApiKeysModal: urlModal === "keys",
            showAddBotModal: urlModal === "add",
          });
          syncUrlAndStorage({
            view: "chat",
            site: matched,
            sessionId: activeSession,
            drawerOpen: Boolean(urlTab),
            drawerTab: urlTab || "pages",
            modal: urlModal,
            replace: true,
          });
          return;
        } else if (urlBotId) {
          get().goHome();
          return;
        }
      }

      if (urlModal === "keys") {
        set({ showApiKeysModal: true });
      } else if (urlModal === "add") {
        set({ showAddBotModal: true });
      }

      const currentSelected = get().selectedSite;
      if (currentSelected) {
        const fresh = sites.find((s) => s.id === currentSelected.id);
        if (fresh) {
          set({ selectedSite: fresh });
          try {
            localStorage.setItem("web_rag_selected_site", JSON.stringify(fresh));
          } catch {}
        }
      }
    } catch (e) {
      console.error("Error in hydrateNavigation:", e);
    }
  },

  // Modals
  openAddBot: () => {
    syncUrlAndStorage({ modal: "add" });
    set({ showAddBotModal: true });
  },
  closeAddBot: () => {
    syncUrlAndStorage({ modal: null });
    set({ showAddBotModal: false });
  },

  openEmbed: (site) => {
    syncUrlAndStorage({ modal: "embed" });
    set({ embedSite: site, showEmbedModal: true });
  },
  closeEmbed: () => {
    syncUrlAndStorage({ modal: null });
    set({ showEmbedModal: false, embedSite: null });
  },

  openSettings: (site) => {
    syncUrlAndStorage({ modal: "settings" });
    set({ settingsSite: site, showSettingsModal: true });
  },
  closeSettings: () => {
    syncUrlAndStorage({ modal: null });
    set({ showSettingsModal: false, settingsSite: null });
  },

  openAnalytics: (site) => {
    syncUrlAndStorage({ modal: "analytics" });
    set({ analyticsSite: site, showAnalyticsModal: true });
  },
  closeAnalytics: () => {
    syncUrlAndStorage({ modal: null });
    set({ showAnalyticsModal: false, analyticsSite: null });
  },

  setShowApiKeysModal: (open) => {
    syncUrlAndStorage({ modal: open ? "keys" : null });
    set({ showApiKeysModal: open });
  },
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

  removeSiteFromList: (siteId) => {
    const s = get();
    const nextSites = s.sites.filter((st) => st.id !== siteId);
    const isSelected = s.selectedSite?.id === siteId;
    if (isSelected) {
      s.goHome();
    }
    set({ sites: nextSites });
  },
}));
