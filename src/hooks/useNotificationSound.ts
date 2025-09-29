let audioInstance: HTMLAudioElement | null = null;

export const useNotificationSound = () => {
  const playNotificationSound = () => {
    try {
      // Criar ou reutilizar instância de áudio
      if (!audioInstance) {
        audioInstance = new Audio('/sounds/notification.mp3');
        audioInstance.volume = 0.5; // Volume controlado
      }

      // Resetar e tocar
      audioInstance.currentTime = 0;
      audioInstance.play().catch(error => {
        console.log('Não foi possível reproduzir o som:', error);
      });
      
    } catch (error) {
      console.log('Não foi possível reproduzir o som:', error);
    }
  };

  return { playNotificationSound };
};
