import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <Card className="max-w-md w-full text-center">
      <CardContent className="pt-8 pb-8">
        <Construction className="h-12 w-12 mx-auto mb-4 text-primary" />
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-muted-foreground">
          Esta funcionalidade será implementada em breve.
        </p>
      </CardContent>
    </Card>
  </div>
);

export default PlaceholderPage;
