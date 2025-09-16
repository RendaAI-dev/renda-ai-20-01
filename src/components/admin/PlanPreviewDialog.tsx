import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star } from 'lucide-react';
import { Plan } from '@/hooks/usePlans';

interface PlanPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  plan: Plan | null;
}

const PlanPreviewDialog: React.FC<PlanPreviewDialogProps> = ({
  isOpen,
  onClose,
  plan
}) => {
  if (!plan) return null;

  const monthlyPrice = plan.price_monthly;
  const annualPrice = plan.price_annual || monthlyPrice * 12;
  const yearlyEquivalent = monthlyPrice * 12;
  const annualDiscount = plan.price_annual 
    ? Math.round(((yearlyEquivalent - annualPrice) / yearlyEquivalent) * 100)
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview do Plano: {plan.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status do Plano */}
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
            <div>
              <h3 className="font-medium">Status atual:</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={plan.is_active ? "default" : "secondary"}>
                  {plan.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
                {plan.is_popular && (
                  <Badge variant="default" className="bg-yellow-500">
                    <Star className="h-3 w-3 mr-1" />
                    Mais Popular
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="ml-auto text-right">
              <p className="text-sm text-muted-foreground">Ordem de exibição:</p>
              <p className="font-medium">#{plan.sort_order}</p>
            </div>
          </div>

          {/* Preview Cards - Como aparecerá para o usuário */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Como será exibido aos usuários:</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card Mensal */}
              <Card className={`relative ${plan.is_popular ? 'ring-2 ring-primary' : ''}`}>
                {plan.is_popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <div className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                      <Star className="h-4 w-4" />
                      Mais Popular
                    </div>
                  </div>
                )}
                
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">{plan.name} - Mensal</CardTitle>
                  <div className="mt-4">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-3xl font-bold">R$ {monthlyPrice.toFixed(2).replace('.', ',')}</span>
                      <span className="text-muted-foreground">/mês</span>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-2">{plan.description}</p>
                </CardHeader>
                
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-3">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  {plan.limitations.length > 0 && (
                    <div className="mb-6">
                      <p className="text-sm font-medium mb-2 text-muted-foreground">Limitações:</p>
                      <ul className="space-y-1">
                        {plan.limitations.map((limitation, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground">
                            • {limitation}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <Button className="w-full" size="lg" disabled>
                    {plan.trial_days > 0 ? `Começar ${plan.trial_days} dias grátis` : 'Assinar Agora'}
                  </Button>
                </CardContent>
              </Card>

              {/* Card Anual (se houver preço anual) */}
              {plan.price_annual && (
                <Card className={`relative ${plan.is_popular ? 'ring-2 ring-primary' : ''}`}>
                  {plan.is_popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <div className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                        <Star className="h-4 w-4" />
                        Mais Popular
                      </div>
                    </div>
                  )}
                  
                  <CardHeader className="text-center">
                    <CardTitle className="text-xl">{plan.name} - Anual</CardTitle>
                    <div className="mt-4">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-3xl font-bold">R$ {annualPrice.toFixed(2).replace('.', ',')}</span>
                        <span className="text-muted-foreground">/ano</span>
                      </div>
                      {annualDiscount > 0 && (
                        <div className="mt-2">
                          <span className="text-sm text-muted-foreground line-through">
                            R$ {yearlyEquivalent.toFixed(2).replace('.', ',')}
                          </span>
                          <span className="ml-2 text-sm font-medium text-green-600">
                            Economize {annualDiscount}%
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-2">{plan.description}</p>
                  </CardHeader>
                  
                  <CardContent>
                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-3">
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    {plan.limitations.length > 0 && (
                      <div className="mb-6">
                        <p className="text-sm font-medium mb-2 text-muted-foreground">Limitações:</p>
                        <ul className="space-y-1">
                          {plan.limitations.map((limitation, idx) => (
                            <li key={idx} className="text-sm text-muted-foreground">
                              • {limitation}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <Button className="w-full" size="lg" disabled>
                      {plan.trial_days > 0 ? `Começar ${plan.trial_days} dias grátis` : 'Melhor Oferta'}
                    </Button>
                    
                    {annualDiscount > 0 && (
                      <p className="text-center text-sm text-green-600 mt-2">
                        💰 Economize R$ {(yearlyEquivalent - annualPrice).toFixed(2).replace('.', ',')} por ano
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Configurações Técnicas */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Configurações Técnicas:</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-3">Stripe Integration</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Price ID Mensal:</span>
                      <p className="font-mono text-xs bg-muted p-1 rounded mt-1">
                        {plan.stripe_price_id_monthly || 'Não configurado'}
                      </p>
                    </div>
                    {plan.stripe_price_id_annual && (
                      <div>
                        <span className="text-muted-foreground">Price ID Anual:</span>
                        <p className="font-mono text-xs bg-muted p-1 rounded mt-1">
                          {plan.stripe_price_id_annual}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-3">Limitações do Sistema</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Máx. Usuários:</span>
                      <span>{plan.max_users || 'Ilimitado'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Teste Grátis:</span>
                      <span>{plan.trial_days} dias</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Slug:</span>
                      <span className="font-mono text-xs">{plan.slug}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={onClose}>
              Fechar Preview
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlanPreviewDialog;