import { MessageCircle } from "lucide-react";
import { STORE_CONFIG } from "@/config/store";

const WhatsAppFloat = () => {
  const url = `https://wa.me/${STORE_CONFIG.phone}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-20 right-4 z-30 w-14 h-14 bg-success text-success-foreground rounded-full flex items-center justify-center shadow-lg shadow-success/30 hover:brightness-110 transition-all"
      aria-label="WhatsApp"
    >
      <MessageCircle className="w-7 h-7" />
    </a>
  );
};

export default WhatsAppFloat;
