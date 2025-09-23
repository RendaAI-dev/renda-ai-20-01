import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, X, Smartphone, Zap, Shield, Wifi } from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { useBrandingConfig } from '@/hooks/useBrandingConfig';

interface PWAInstallModalProps {
  isOpen: boolean;
  onInstall: () => void;
  onDismiss: (forever?: boolean) => void;
  isInstalling: boolean;
}

const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onInstall,
  onDismiss,
  isInstalling
}) => {
  const { companyName } = useBrandingConfig();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => onDismiss(false)}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-md z-50"
          >
            <Card className="relative bg-background/95 backdrop-blur-lg border shadow-2xl overflow-hidden">
              {/* Close button */}
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-3 right-3 z-10"
                onClick={() => onDismiss(false)}
              >
                <X className="h-4 w-4" />
              </Button>

              <div className="p-6 space-y-4">
                {/* Header */}
                <div className="text-center space-y-2">
                  <BrandLogo size="md" showCompanyName={false} />
                  <h3 className="text-lg font-semibold text-foreground">
                    Instalar {companyName}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Adicione nosso app à sua tela inicial para uma experiência melhor
                  </p>
                </div>

                {/* Benefits */}
                <div className="grid grid-cols-2 gap-3 py-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <Zap className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-muted-foreground">Mais rápido</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <div className="p-1.5 rounded-lg bg-secondary/10">
                      <Wifi className="h-3 w-3 text-secondary" />
                    </div>
                    <span className="text-muted-foreground">Funciona offline</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <div className="p-1.5 rounded-lg bg-accent/10">
                      <Shield className="h-3 w-3 text-accent" />
                    </div>
                    <span className="text-muted-foreground">Mais seguro</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <Smartphone className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-muted-foreground">Como um app</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-3 pt-2">
                  <Button
                    onClick={onInstall}
                    disabled={isInstalling}
                    className="w-full"
                    size="lg"
                  >
                    {isInstalling ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="mr-2"
                      >
                        <Download className="h-4 w-4" />
                      </motion.div>
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    {isInstalling ? 'Instalando...' : 'Instalar App'}
                  </Button>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => onDismiss(false)}
                      className="flex-1"
                      size="sm"
                    >
                      Agora não
                    </Button>
                    
                    <Button
                      variant="ghost"
                      onClick={() => onDismiss(true)}
                      className="flex-1 text-xs"
                      size="sm"
                    >
                      Não mostrar novamente
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PWAInstallModal;