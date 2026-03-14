import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Clock, MapPin, Phone, CheckCircle, Bike, XCircle } from "lucide-react";
import { toast } from "sonner";

const issueLabels: Record<string, { label: string; icon: string }> = {
  no_answer: { label: "Cliente não respondeu", icon: "📵" },
  wrong_address: { label: "Endereço errado", icon: "📍" },
  cancelled: { label: "Pedido cancelado", icon: "❌" },
  order_problem: { label: "Problema no pedido", icon: "⚠️" },
};

const DeliveryAlerts = () => {
  const [delayAlerts, setDelayAlerts] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [tab, setTab] = useState("delays");

  const fetchDelayAlerts = async () => {
    const { data } = await supabase
      .from("kitchen_alerts")
      .select("*")
      .ilike("message", "%ATRASO%")
      .order("created_at", { ascending: false })
      .limit(50);
    setDelayAlerts(data || []);
  };

  const fetchIssues = async () => {
    const { data } = await supabase
      .from("delivery_issues")
      .select(`
        *,
        orders:order_id (order_number, customer_name, customer_phone, status),
        delivery_persons:delivery_person_id (name, phone)
      `)
      .order("created_at", { ascending: false })
      .limit(50);
    setIssues(data || []);
  };

  useEffect(() => {
    fetchDelayAlerts();
    fetchIssues();
  }, []);

  // Realtime
  useEffect(() => {
    const ch1 = supabase
      .channel("admin-delay-alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "kitchen_alerts" }, () => {
        fetchDelayAlerts();
      })
      .subscribe();

    const ch2 = supabase
      .channel("admin-delivery-issues")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "delivery_issues" }, (payload: any) => {
        fetchIssues();
        const issue = payload.new;
        const info = issueLabels[issue?.issue_type] || { label: "Problema", icon: "⚠️" };
        toast.error(`${info.icon} Problema reportado: ${info.label}`, { duration: 10000 });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, []);

  const acknowledgeAlert = async (id: string) => {
    await supabase.from("kitchen_alerts").update({ acknowledged: true } as any).eq("id", id);
    fetchDelayAlerts();
    toast.success("Alerta reconhecido");
  };

  const pendingDelays = delayAlerts.filter(a => !a.acknowledged);
  const pendingIssues = issues.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <h2 className="text-lg font-bold">Alertas de Entrega</h2>
        {(pendingDelays.length > 0 || pendingIssues > 0) && (
          <Badge variant="destructive" className="animate-pulse">
            {pendingDelays.length + pendingIssues} pendentes
          </Badge>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="delays" className="flex-1 gap-1">
            <Clock className="h-4 w-4" />
            Atrasos
            {pendingDelays.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">{pendingDelays.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="issues" className="flex-1 gap-1">
            <AlertTriangle className="h-4 w-4" />
            Problemas
            {pendingIssues > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">{pendingIssues}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="delays" className="space-y-3 mt-4">
          {delayAlerts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum alerta de atraso</p>
          ) : (
            delayAlerts.map((alert) => (
              <Card key={alert.id} className={!alert.acknowledged ? "border-destructive" : "opacity-60"}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        {!alert.acknowledged ? (
                          <span className="text-lg">⏰</span>
                        ) : (
                          <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <p className="text-sm font-medium text-foreground">{alert.message}</p>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(alert.created_at).toLocaleString("pt-BR", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {!alert.acknowledged && (
                      <Button size="sm" variant="outline" onClick={() => acknowledgeAlert(alert.id)}>
                        OK
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="issues" className="space-y-3 mt-4">
          {issues.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum problema reportado</p>
          ) : (
            issues.map((issue: any) => {
              const info = issueLabels[issue.issue_type] || { label: issue.issue_type, icon: "⚠️" };
              return (
                <Card key={issue.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{info.icon}</span>
                        <p className="font-medium text-foreground">{info.label}</p>
                      </div>
                      <Badge variant="outline">
                        #{issue.orders?.order_number || "?"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {issue.orders?.customer_name && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {issue.orders.customer_name}
                        </span>
                      )}
                      {issue.delivery_persons?.name && (
                        <span className="flex items-center gap-1">
                          <Bike className="h-3 w-3" /> {issue.delivery_persons.name}
                        </span>
                      )}
                      {issue.orders?.customer_phone && (
                        <a href={`tel:${issue.orders.customer_phone}`} className="flex items-center gap-1 text-primary">
                          <Phone className="h-3 w-3" /> {issue.orders.customer_phone}
                        </a>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(issue.created_at).toLocaleString("pt-BR", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {issue.notes && (
                      <p className="text-sm text-foreground bg-muted rounded p-2">{issue.notes}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DeliveryAlerts;
