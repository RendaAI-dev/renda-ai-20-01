import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bell, 
  Check, 
  Trash2, 
  Calendar,
  DollarSign,
  Target,
  CreditCard,
  Megaphone,
  AlertCircle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'system' | 'marketing' | 'transaction' | 'goal' | 'schedule' | 'payment';
  category?: string;
  is_read: boolean;
  data?: any;
  created_at: string;
  read_at?: string;
}

interface NotificationListProps {
  notifications: Notification[];
  isLoading: boolean;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  isMarkingAsRead?: boolean;
  isDeleting?: boolean;
  compact?: boolean;
  showEmpty?: boolean;
  emptyMessage?: string;
  height?: string;
}

const typeIcons = {
  system: AlertCircle,
  marketing: Megaphone,
  transaction: DollarSign,
  goal: Target,
  schedule: Calendar,
  payment: CreditCard
};

const typeColors = {
  system: "default",
  marketing: "secondary",
  transaction: "outline",
  goal: "default",
  schedule: "outline",
  payment: "default"
} as const;

export function NotificationList({
  notifications,
  isLoading,
  onMarkAsRead,
  onDelete,
  isMarkingAsRead = false,
  isDeleting = false,
  compact = false,
  showEmpty = true,
  emptyMessage = "Nenhuma notificação",
  height = "auto"
}: NotificationListProps) {
  const NotificationItem = ({ notification }: { notification: Notification }) => {
    const IconComponent = typeIcons[notification.type];
    
    if (compact) {
      return (
        <div
          className={`p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted ${
            !notification.is_read ? 'bg-primary/5 border border-primary/20' : ''
          }`}
          onClick={() => !notification.is_read && onMarkAsRead(notification.id)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${
                !notification.is_read ? 'text-foreground' : 'text-muted-foreground'
              }`}>
                {notification.title}
              </p>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {notification.message}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(notification.created_at), {
                  addSuffix: true,
                  locale: ptBR
                })}
              </p>
            </div>
            {!notification.is_read && (
              <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1"></div>
            )}
          </div>
        </div>
      );
    }
    
    return (
      <Card className={`mb-3 transition-all hover:shadow-md ${!notification.is_read ? 'border-primary/50 bg-primary/5' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className={`p-2 rounded-full ${!notification.is_read ? 'bg-primary/10' : 'bg-muted'}`}>
                <IconComponent className={`h-4 w-4 ${!notification.is_read ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className={`font-medium ${!notification.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {notification.title}
                  </h4>
                  <Badge variant={typeColors[notification.type]}>
                    {notification.type}
                  </Badge>
                  {!notification.is_read && (
                    <Badge variant="default">Nova</Badge>
                  )}
                </div>
                
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {notification.message}
                </p>
                
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(notification.created_at), {
                    addSuffix: true,
                    locale: ptBR
                  })}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              {!notification.is_read && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onMarkAsRead(notification.id)}
                  disabled={isMarkingAsRead}
                >
                  <Check className="h-4 w-4" />
                </Button>
              )}
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(notification.id)}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (notifications.length === 0 && showEmpty) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">{emptyMessage}</h3>
          <p className="text-muted-foreground">
            Você não tem notificações no momento.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <ScrollArea className={height === "auto" ? "h-80" : height}>
        <div className="space-y-2">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
            />
          ))}
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className={height === "auto" ? "h-[calc(100vh-16rem)]" : height}>
      <div className="space-y-3">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
          />
        ))}
      </div>
    </ScrollArea>
  );
}