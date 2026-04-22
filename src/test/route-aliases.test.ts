import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Garante que toda rota antiga em inglês permaneça acessível
 * como alias da rota canônica em português, apontando para o
 * mesmo componente em src/App.tsx.
 *
 * O teste lê App.tsx como texto e verifica, para cada par
 * EN -> PT, que ambos os caminhos aparecem associados ao
 * mesmo elemento React (<Componente />).
 */

const appSource = readFileSync(
  resolve(__dirname, "../App.tsx"),
  "utf-8",
);

// Pares [rotaEN, rotaPT] que devem coexistir como aliases.
// Cobre rotas top-level + rotas filhas do AdminLayout (renderizadas
// para ambos os bases /admin e /painel via App.tsx).
const TOP_LEVEL_ALIASES: Array<[string, string]> = [
  ["/auth", "/entrar"],
  ["/checkout", "/finalizar"],
  ["/order-success", "/pedido-confirmado"],
  ["/admin/login", "/painel/login"],
  ["/waiter/login", "/garcom/login"],
  ["/waiter", "/garcom"],
  ["/waiter/new-order", "/garcom/novo-pedido"],
  ["/table-qr/:tableNumber", "/mesa-qr/:tableNumber"],
  ["/tracking/:token", "/rastreio/:token"],
  ["/driver/login", "/entregador/login"],
  ["/driver", "/entregador"],
];

const ADMIN_CHILD_ALIASES: Array<[string, string]> = [
  ["order-history", "historico-pedidos"],
  ["new-order", "novo-pedido"],
  ["menu-manager", "cardapio"],
  ["invoices", "notas-fiscais"],
  ["payment-failures", "falhas-pagamento"],
  ["driver-chat", "chat-entregador"],
  ["salon", "salao"],
  ["salon-settings", "config-salao"],
  ["contacts", "contatos"],
  ["reports", "relatorios"],
  ["delivery-fees", "taxas-entrega"],
  ["digital-menu", "cardapio-digital"],
  ["establishment", "estabelecimento"],
  ["delivery-persons", "entregadores"],
  ["delivery-alerts", "alertas-entrega"],
  ["whatsapp-outbox", "whatsapp-fila"],
  ["whatsapp-connect", "whatsapp-conectar"],
  ["external-integrations", "integracoes-externas"],
  ["routing", "roteirizacao"],
  ["routes", "rotas"],
  ["operational-map", "mapa-operacional"],
  ["drivers-mgmt", "gestao-entregadores"],
  ["routing-config", "config-roteirizacao"],
];

/** Extrai o nome do componente associado a um caminho em <Route path="X" element={<Comp />} /> */
function elementForPath(path: string): string | null {
  // Escape regex special chars in path
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `path=["\`']${escaped}["\`'][^>]*element=\\{<\\s*(\\w+)`,
  );
  const m = appSource.match(re);
  return m ? m[1] : null;
}

describe("Aliases de rotas EN -> PT em App.tsx", () => {
  it("AdminLayout é montado tanto em /admin quanto em /painel", () => {
    expect(appSource).toMatch(/\[`?\/admin`?,\s*`?\/painel`?\]/);
    expect(appSource).toMatch(/element=\{<AdminLayout\s*\/?>/);
  });

  describe("Rotas top-level", () => {
    for (const [en, pt] of TOP_LEVEL_ALIASES) {
      it(`${en}  ⇄  ${pt}`, () => {
        const enComp = elementForPath(en);
        const ptComp = elementForPath(pt);
        expect(enComp, `Rota EN ausente: ${en}`).not.toBeNull();
        expect(ptComp, `Rota PT ausente: ${pt}`).not.toBeNull();
        expect(enComp).toBe(ptComp);
      });
    }
  });

  describe("Rotas filhas do painel admin", () => {
    for (const [en, pt] of ADMIN_CHILD_ALIASES) {
      it(`${en}  ⇄  ${pt}`, () => {
        const enComp = elementForPath(en);
        const ptComp = elementForPath(pt);
        expect(enComp, `Subrota EN ausente: ${en}`).not.toBeNull();
        expect(ptComp, `Subrota PT ausente: ${pt}`).not.toBeNull();
        expect(enComp).toBe(ptComp);
      });
    }
  });
});
