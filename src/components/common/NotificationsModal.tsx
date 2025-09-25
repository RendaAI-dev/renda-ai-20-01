import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BellRing, CheckCheck } from "lucide-react";
import { NotificationList } from "./NotificationList";
import { toast } from "@/hooks/use-toast";

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

interface NotificationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationsModal({ open, onOpenChange }: NotificationsModalProps) {
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
    },
    enabled: open
  });

  // Buscar contagem de não lidas
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_unread_notifications_count");
      if (error) throw error;
      return data;
    },
    enabled: open
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BellRing className="h-6 w-6" />
              <DialogTitle>Notificações</DialogTitle>
              {unreadCount > 0 && (
                <Badge variant="default">{unreadCount} não lidas</Badge>
              )}
            </div>
            
            {unreadCount > 0 && (
              <Button
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
                variant="outline"
                size="sm"
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                Marcar todas como lidas
              </Button>
            )}
          </div>
        </DialogHeader>

        <Separator />

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-7 mb-4">
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="unread">Não lidas</TabsTrigger>
            <TabsTrigger value="transaction">Transações</TabsTrigger>
            <TabsTrigger value="goal">Metas</TabsTrigger>
            <TabsTrigger value="schedule">Agendadas</TabsTrigger>
            <TabsTrigger value="payment">Pagamentos</TabsTrigger>
            <TabsTrigger value="marketing">Marketing</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedTab} className="flex-1">
            <NotificationList
              notifications={notifications}
              isLoading={isLoading}
              onMarkAsRead={handleMarkAsRead}
              onDelete={handleDelete}
              isMarkingAsRead={markAsReadMutation.isPending}
              isDeleting={deleteNotificationMutation.isPending}
              height="h-[50vh]"
              emptyMessage={selectedTab === "all" 
                ? "Nenhuma notificação"
                : `Nenhuma notificação do tipo "${selectedTab}"`
              }
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}