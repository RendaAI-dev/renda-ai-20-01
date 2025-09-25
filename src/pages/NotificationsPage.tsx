import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { 
  Bell, 
  BellRing, 
  Check, 
  CheckCheck, 
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

export default function NotificationsPage() {
  const [selectedTab, setSelectedTab] = useState("all");
  const queryClient = useQueryClient();

  // Buscar notificações
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", selectedTab],
    queryFn: async () => {
      let query = supabase
        .from("poupeja_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (selectedTab !== "all") {
        if (selectedTab === "unread") {
          query = query.eq("is_read", false);
        } else {
          query = query.eq("type", selectedTab);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Notification[];
    }
  });

  // Buscar contagem de não lidas
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_unread_notifications_count");
      if (error) throw error;
      return data;
    }
  });

  // Marcar como lida
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase.rpc("mark_notification_read", {
        notification_id: notificationId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível marcar a notificação como lida.",
        variant: "destructive"
      });
    }
  });

  // Marcar todas como lidas
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("mark_all_notifications_read");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
      toast({
        title: "Sucesso",
        description: "Todas as notificações foram marcadas como lidas."
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível marcar todas as notificações como lidas.",
        variant: "destructive"
      });
    }
  });

  // Excluir notificação
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("poupeja_notifications")
        .delete()
        .eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
      toast({
        title: "Sucesso",
        description: "Notificação excluída com sucesso."
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir a notificação.",
        variant: "destructive"
      });
    }
  });

  const handleMarkAsRead = (notificationId: string) => {
    markAsReadMutation.mutate(notificationId);
  };

  const handleDelete = (notificationId: string) => {
    deleteNotificationMutation.mutate(notificationId);
  };

  const NotificationItem = ({ notification }: { notification: Notification }) => {
    const IconComponent = typeIcons[notification.type];
    
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
                  onClick={() => handleMarkAsRead(notification.id)}
                  disabled={markAsReadMutation.isPending}
                >
                  <Check className="h-4 w-4" />
                </Button>
              )}
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(notification.id)}
                disabled={deleteNotificationMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BellRing className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Notificações</h1>
            {unreadCount > 0 && (
              <Badge variant="default">{unreadCount} não lidas</Badge>
            )}
          </div>
          
          {unreadCount > 0 && (
            <Button
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              variant="outline"
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Marcar todas como lidas
            </Button>
          )}
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="unread">Não lidas</TabsTrigger>
          <TabsTrigger value="transaction">Transações</TabsTrigger>
          <TabsTrigger value="goal">Metas</TabsTrigger>
          <TabsTrigger value="schedule">Agendadas</TabsTrigger>
          <TabsTrigger value="payment">Pagamentos</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="mt-6">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : notifications.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma notificação</h3>
                <p className="text-muted-foreground">
                  {selectedTab === "all" 
                    ? "Você não tem notificações no momento."
                    : `Você não tem notificações do tipo "${selectedTab}".`
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}