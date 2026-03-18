// src/lib/platformModules.ts
export const PLATFORM_MODULES = [
  "Ad", "Adswizz", "Feeds", "Analytics", "Channel", "Customer", "Coupon",
  "Customer Data Platform (CDP)", "Federation", "Products", "Purchase",
  "Link", "Live Video", "Live Video Mediapackage", "Live Video MediaLive",
  "Live Audio", "Speech To Text", "Watchfolder", "Live Editor", "AI",
  "Live Moments", "Live Restreaming", "Machine Learning", "Media",
  "Migration", "Image", "Playlist", "Rendition Rules", "Encoder",
  "CDN Balancer", "Video Templates", "Zoom", "Gracenote", "External CDN",
  "Playout", "Billing", "Assistant", "I18n", "Full Access Token", "DRM",
  "Distribution", "Integrators", "Opta", "Next", "Peering", "Sale", "Show",
  "WebHooks", "Widget", "Live Google DAI", "VOD Google DAI", "Articles",
  "Mailchimp", "Emblue", "Fast Channel", "EPG (Origin)", "EPG (Output)",
  "Api & Tokens", "General",
] as const;

export type PlatformModule = typeof PLATFORM_MODULES[number];
