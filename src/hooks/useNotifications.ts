import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Notification {
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

export function useNotifications() {
  const queryClient = useQueryClient();

  // Query para buscar notificações
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("poupeja_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as Notification[];
    }
  });

  // Query para contar notificações não lidas
  const unreadCountQuery = useQuery({
    queryKey: ["notifications-count"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_unread_notifications_count");
      if (error) throw error;
      return data as number;
    }
  });

  // Mutation para marcar como lida
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
    }
  });

  // Mutation para marcar todas como lidas
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
    }
  });

  // Mutation para criar notificação de teste
  const createTestNotificationMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("create-notification", {
        body: {
          title: "Notificação de Teste",
          message: "Esta é uma notificação de teste para verificar o sistema.",
          type: "system",
          category: "test"
        }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
      toast({
        title: "Sucesso",
        description: "Notificação de teste criada!"
      });
    }
  });

  // Mutation para excluir notificação
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

  // Setup realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'poupeja_notifications'
        },
        (payload) => {
          console.log('Notification change detected:', payload);
          
          // Invalidar queries para atualizar a UI
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
          
          // Mostrar toast para novas notificações
          if (payload.eventType === 'INSERT' && payload.new) {
            const newNotification = payload.new as Notification;
            toast({
              title: newNotification.title,
              description: newNotification.message,
              duration: 5000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    notifications: notificationsQuery.data || [],
    unreadCount: unreadCountQuery.data || 0,
    isLoading: notificationsQuery.isLoading || unreadCountQuery.isLoading,
    error: notificationsQuery.error || unreadCountQuery.error,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    deleteNotification: deleteNotificationMutation.mutate,
    createTestNotification: createTestNotificationMutation.mutate,
    isMarkingAsRead: markAsReadMutation.isPending,
    isMarkingAllAsRead: markAllAsReadMutation.isPending,
    isDeleting: deleteNotificationMutation.isPending,
    isCreatingTest: createTestNotificationMutation.isPending,
    refetch: () => {
      notificationsQuery.refetch();
      unreadCountQuery.refetch();
    }
  };
}