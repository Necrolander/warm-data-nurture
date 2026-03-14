import { useParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import logo from "@/assets/logo-truebox-new.png";
import { Smartphone, UtensilsCrossed, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const TableQRPrint = () => {
  const { tableNumber } = useParams();
  const num = parseInt(tableNumber || "1");
  const menuUrl = `${window.location.origin}/?mesa=${num}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(menuUrl)}&margin=10`;

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      {/* Print button - hidden during print */}
      <div className="fixed top-4 right-4 print:hidden z-50">
        <Button onClick={handlePrint} className="shadow-lg">
          🖨️ Imprimir
        </Button>
      </div>

      <div className="w-full max-w-[400px] bg-white rounded-3xl overflow-hidden shadow-2xl print:shadow-none border border-gray-100 print:border-none">
        {/* Header with table number */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white py-6 px-6 text-center">
          <img src={logo} alt="Truebox" className="h-12 mx-auto mb-3" style={{ filter: "brightness(10)" }} />
          <div className="text-5xl font-black tracking-tight">
            MESA {num}
          </div>
        </div>

        {/* QR Code section */}
        <div className="px-8 pt-8 pb-4 text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-1">
            Economize tempo e
          </h2>
          <h2 className="text-xl font-bold text-gray-800 mb-6">
            peça pelo QRCode
          </h2>

          <div className="bg-white p-4 rounded-2xl border-2 border-gray-100 inline-block shadow-sm">
            <img
              src={qrUrl}
              alt={`QR Code Mesa ${num}`}
              className="w-56 h-56 mx-auto"
              crossOrigin="anonymous"
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="px-8 pb-8 pt-4">
          <div className="flex justify-center gap-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xs font-medium text-gray-600 leading-tight">
                Escaneie no<br />celular
              </span>
            </div>

            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <UtensilsCrossed className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xs font-medium text-gray-600 leading-tight">
                Escolha o<br />seu pedido
              </span>
            </div>

            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xs font-medium text-gray-600 leading-tight">
                Finalize<br />direto pelo celular
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <span className="text-xs text-gray-400 font-medium">Truebox Hamburgueria</span>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { margin: 0; size: auto; }
          body { margin: 0; }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
        }
      `}</style>
    </div>
  );
};

export default TableQRPrint;
