import { Card, CardContent } from "@/components/ui/card";

interface ModuleStatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

const ModuleStatCard = ({ label, value, icon }: ModuleStatCardProps) => (
  <Card className="border-l-2 border-l-border">
    <CardContent className="p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium truncate">{label}</p>
        <p className="text-xl font-bold text-foreground leading-tight mt-0.5">{value}</p>
      </div>
    </CardContent>
  </Card>
);

export default ModuleStatCard;
