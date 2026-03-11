import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import logo from "@/assets/logo-truebox-new.png";

const isInAppBrowser = (): boolean => {
  const ua = navigator.userAgent || navigator.vendor || "";
  // Detect common in-app browsers
  return /FBAN|FBAV|Instagram|Line\/|Twitter|Snapchat|BytedanceWebview|TikTok/i.test(ua);
};

const getExternalUrl = (): string => {
  const url = window.location.href;
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);

  if (isIOS) {
    // Use x-safari-https scheme or just open in Safari via intent
    return url;
  }
  if (isAndroid) {
    // intent:// scheme opens in Chrome/default browser
    const intentUrl = url.replace(/^https?:\/\//, "");
    return `intent://${intentUrl}#Intent;scheme=https;end`;
  }
  return url;
};

const openInExternalBrowser = () => {
  const url = window.location.href;
  const isAndroid = /Android/i.test(navigator.userAgent);

  if (isAndroid) {
    // Android intent to open in default browser
    const intentUrl = url.replace(/^https?:\/\//, "");
    window.location.href = `intent://${intentUrl}#Intent;scheme=https;end`;
  } else {
    // iOS: open in Safari - window.open sometimes works
    window.open(url, "_blank");
  }
};

interface InAppBrowserGateProps {
  children: React.ReactNode;
}

const InAppBrowserGate = ({ children }: InAppBrowserGateProps) => {
  const [isInApp, setIsInApp] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setIsInApp(isInAppBrowser());
  }, []);

  if (!isInApp || dismissed) {
    return <>{children}</>;
  }

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-sm"
      >
        <img
          src={logo}
          alt="Truebox"
          className="mx-auto mb-6 w-44 h-auto"
          style={{ mixBlendMode: "screen" }}
        />

        <h2 className="text-2xl font-black text-foreground mb-3">
          Abra no navegador! 🌐
        </h2>

        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
          Para uma melhor experiência (localização, pagamento), abra nosso site no{" "}
          <strong className="text-foreground">{isIOS ? "Safari" : "Chrome"}</strong>.
        </p>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={openInExternalBrowser}
          className="w-full bg-primary text-primary-foreground font-bold text-lg px-8 py-4 rounded-xl shadow-lg shadow-primary/30 hover:brightness-110 transition-all mb-3"
        >
          ABRIR NO {isIOS ? "SAFARI" : "CHROME"} 🚀
        </motion.button>

        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground text-sm underline hover:text-foreground transition-colors"
        >
          Continuar aqui mesmo
        </button>

        {isIOS && (
          <div className="mt-6 bg-muted rounded-xl p-4 text-left text-sm text-muted-foreground">
            <p className="font-bold text-foreground mb-1">📱 No iPhone:</p>
            <p>
              Toque nos <strong>3 pontinhos</strong> (⋯) no canto inferior direito do Instagram → <strong>"Abrir no Safari"</strong>
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default InAppBrowserGate;
