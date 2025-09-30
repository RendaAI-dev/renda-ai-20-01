import React, { useEffect } from 'react';
import { useNotificationInit } from '@/hooks/useNotificationInit';

interface AppInitializerProps {
  children: React.ReactNode;
}

export const AppInitializer: React.FC<AppInitializerProps> = ({ children }) => {
  // Inicializar notificações dentro de um componente separado
  useNotificationInit();

  return <>{children}</>;
};
