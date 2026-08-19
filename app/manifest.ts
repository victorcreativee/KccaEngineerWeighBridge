import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest { return { name: "Buyala Waste Operations", short_name: "Buyala Ops", description: "Weighbridge operations for Buyala Waste Management Facility.", start_url: "/", display: "standalone", background_color: "#f4f6f4", theme_color: "#102f27", orientation: "any" }; }
