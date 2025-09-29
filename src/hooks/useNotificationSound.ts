export const useNotificationSound = () => {
  const playNotificationSound = () => {
    try {
      // Criar contexto de áudio
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Criar oscilador para o som
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Conectar nós
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Configurar som (duas notas rápidas)
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
      
      // Configurar volume com fade
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      // Tocar som
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      
      // Limpar após tocar
      setTimeout(() => {
        audioContext.close();
      }, 500);
      
    } catch (error) {
      console.log('Não foi possível reproduzir o som:', error);
    }
  };

  return { playNotificationSound };
};
