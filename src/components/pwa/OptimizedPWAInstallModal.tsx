import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, X, Smartphone, Zap, Shield, Wifi } from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { useBrandingConfig } from '@/hooks/useBrandingConfig';

interface OptimizedPWAInstallModalProps {
  isOpen: boolean;
  onInstall: () => void;
  onDismiss: (forever?: boolean) => void;
  isInstalling: boolean;
  canInstall: boolean;
}

const OptimizedPWAInstallModal: React.FC<OptimizedPWAInstallModalProps> = ({
  isOpen,
  onInstall,
  onDismiss,
  isInstalling,
  canInstall
}) => {
  const { companyName } = useBrandingConfig();

  if (!isOpen) return null;

  const benefits = [
    {
      icon: Zap,
      title: "Acesso Instantâneo",
      description: "Abra diretamente da tela inicial"
    },
    {
      icon: Wifi,
      title: "Funciona Offline",
      description: "Use mesmo sem internet"
    },
    {
      icon: Shield,
      title: "Mais Seguro",
      description: "Não ocupa espaço como um app normal"
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <Card className="w-full max-w-md bg-background border-2 shadow-lg animate-scale-in">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <BrandLogo size="sm" />
              <div>
                <h3 className="font-semibold text-lg">Instalar {companyName}</h3>
                <p className="text-sm text-muted-foreground">Como aplicativo</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDismiss()}
              className="hover-scale"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Benefits */}
          <div className="space-y-4">
            {benefits.map((benefit, index) => (
              <div 
                key={benefit.title} 
                className="flex items-start space-x-3 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  <benefit.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">{benefit.title}</h4>
                  <p className="text-xs text-muted-foreground">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Install Instructions */}
          {!canInstall && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center space-x-2">
                <Smartphone className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Como instalar:</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Toque no botão "Compartilhar" do seu navegador</p>
                <p>• Selecione "Adicionar à Tela Inicial"</p>
                <p>• Confirme tocando em "Adicionar"</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col space-y-2">
            {canInstall && (
              <Button 
                onClick={onInstall} 
                disabled={isInstalling}
                className="w-full hover-scale"
                size="lg"
              >
                <Download className="h-4 w-4 mr-2" />
                {isInstalling ? 'Instalando...' : 'Instalar Aplicativo'}
              </Button>
            )}
            
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={() => onDismiss()} 
                className="flex-1 hover-scale"
                size="sm"
              >
                Mais tarde
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => onDismiss(true)} 
                className="flex-1 hover-scale text-xs"
                size="sm"
              >
                Não mostrar novamente
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default OptimizedPWAInstallModal;