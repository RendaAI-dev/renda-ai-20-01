import { useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationList } from "./NotificationList";
import { NotificationsModal } from "./NotificationsModal";

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    deleteNotification,
    isLoading 
  } = useNotifications();

  const handleNotificationClick = (notificationId: string, isRead: boolean) => {
    if (!isRead) {
      markAsRead(notificationId);
    }
  };

  const handleViewAll = () => {
    setIsOpen(false);
    setShowModal(true);
  };

  const recentNotifications = notifications.slice(0, 5);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="relative"
          disabled={isLoading}
        >
          {unreadCount > 0 ? (
            <BellRing className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80" align="end">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Notificações</h4>
            {unreadCount > 0 && (
              <Badge variant="secondary">
                {unreadCount} não lidas
              </Badge>
            )}
          </div>
          
          <Separator />
          
          <NotificationList
            notifications={recentNotifications}
            isLoading={isLoading}
            onMarkAsRead={(id) => handleNotificationClick(id, false)}
            onDelete={deleteNotification}
            compact={true}
            showEmpty={true}
            emptyMessage="Nenhuma notificação"
          />
          
          <Separator />
          
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={handleViewAll}
          >
            Ver todas as notificações
          </Button>
        </div>
      </PopoverContent>
      
      <NotificationsModal 
        open={showModal}
        onOpenChange={setShowModal}
      />
    </Popover>
  );
}