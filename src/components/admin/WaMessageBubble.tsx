import { format } from "date-fns";
import { useEffect, useRef } from "react";
import { ExternalLink, Sparkles } from "lucide-react";

interface WaMessageBubbleProps {
  message: {
    id: string;
    direction: string;
    message: string;
    created_at: string;
    media_type?: string | null;
    media_url?: string | null;
    media_mime?: string | null;
    location_lat?: number | null;
    location_lng?: number | null;
    ai_analysis?: string | null;
  };
}

declare global {
  interface Window { L?: any }
}

function ensureLeaflet(): Promise<any> {
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-leaflet]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.setAttribute("data-leaflet", "true");
      document.head.appendChild(link);
    }
    if (document.querySelector('script[data-leaflet]')) {
      const wait = setInterval(() => {
        if (window.L) { clearInterval(wait); resolve(window.L); }
      }, 50);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.setAttribute("data-leaflet", "true");
    s.onload = () => resolve(window.L);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function MiniMap({ lat, lng }: { lat: number; lng: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: any;
    ensureLeaflet().then((L) => {
      if (!ref.current) return;
      map = L.map(ref.current, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false }).setView([lat, lng], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      L.marker([lat, lng]).addTo(map);
      setTimeout(() => map.invalidateSize(), 100);
    });
    return () => { try { map?.remove(); } catch {} };
  }, [lat, lng]);
  return <div ref={ref} className="w-full h-40 rounded-md overflow-hidden border" />;
}

export function WaMessageBubble({ message: m }: WaMessageBubbleProps) {
  const isOut = m.direction === "out";
  const isLocation = m.media_type === "location" && m.location_lat != null && m.location_lng != null;
  const isImage = m.media_type === "image" && m.media_url;
  const isAudio = m.media_type === "audio" && m.media_url;
  const gmapsUrl = isLocation
    ? `https://www.google.com/maps?q=${m.location_lat},${m.location_lng}`
    : null;

  return (
    <div className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[70%] px-3 py-2 rounded-lg shadow-sm space-y-2 ${
          isOut ? "bg-green-600 text-white rounded-br-none" : "bg-card border rounded-bl-none"
        }`}
      >
        {isLocation && (
          <div className="space-y-1.5">
            <MiniMap lat={m.location_lat!} lng={m.location_lng!} />
            <a
              href={gmapsUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1 text-xs underline ${isOut ? "text-green-50" : "text-primary"}`}
            >
              <ExternalLink className="h-3 w-3" /> Abrir no Google Maps
            </a>
          </div>
        )}

        {isImage && (
          <a href={m.media_url!} target="_blank" rel="noopener noreferrer">
            <img
              src={m.media_url!}
              alt="imagem do cliente"
              className="rounded-md max-h-64 w-auto object-cover"
              loading="lazy"
            />
          </a>
        )}

        {isAudio && (
          <audio controls src={m.media_url!} className="max-w-full" />
        )}

        {m.message && !isLocation && (
          <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
        )}

        {m.ai_analysis && (
          <div className={`text-xs rounded p-2 flex gap-1.5 ${isOut ? "bg-green-700/40" : "bg-primary/10 text-foreground"}`}>
            <Sparkles className="h-3 w-3 mt-0.5 shrink-0" />
            <span className="whitespace-pre-wrap">{m.ai_analysis}</span>
          </div>
        )}

        <p className={`text-[10px] text-right ${isOut ? "text-green-100" : "text-muted-foreground"}`}>
          {format(new Date(m.created_at), "HH:mm")}
        </p>
      </div>
    </div>
  );
}
