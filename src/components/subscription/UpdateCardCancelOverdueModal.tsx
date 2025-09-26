import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, Loader2, AlertTriangle, Zap } from 'lucide-react';
import { SavedCardSelector } from '@/components/checkout/SavedCardSelector';
import { CreditCardForm } from '@/components/checkout/CreditCardForm';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UpdateCardCancelOverdueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface CreditCardData {
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
  holderName: string;
  holderCpf: string;
}

const UpdateCardCancelOverdueModal: React.FC<UpdateCardCancelOverdueModalProps> = ({
  open,
  onOpenChange,
  onSuccess
}) => {
  const [selectedCardToken, setSelectedCardToken] = useState<string | null>(null);
  const [useNewCard, setUseNewCard] = useState(false);
  const [saveCard, setSaveCard] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState(false);
  
  const [cardData, setCardData] = useState<CreditCardData>({
    number: '',
    expiryMonth: '',
    expiryYear: '',
    ccv: '',
    holderName: '',
    holderCpf: ''
  });

  const handleCardSelect = (cardToken: string | null) => {
    setSelectedCardToken(cardToken);
    setUseNewCard(cardToken === null);
  };

  const handleNewCard = () => {
    setUseNewCard(true);
    setSelectedCardToken(null);
  };

  const handleCardDataChange = (field: keyof CreditCardData, value: string) => {
    setCardData(prev => ({ ...prev, [field]: value }));
  };

  const handleUpdateCard = async () => {
    if (!confirmAction) {
      toast.error('Por favor, confirme que entende as consequências desta ação');
      return;
    }

    if (!selectedCardToken && !isNewCardValid()) {
      toast.error('Por favor, selecione um cartão ou preencha os dados do novo cartão');
      return;
    }

    setIsLoading(true);

    try {
      const requestBody = {
        scenario: 'update_card_cancel_overdue' as const,
        cardToken: selectedCardToken,
        cardData: useNewCard ? cardData : undefined,
        saveCard: useNewCard ? saveCard : false
      };

      const { data, error } = await supabase.functions.invoke('update-card-direct', {
        body: requestBody
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        // Se é erro de cartão inválido, trocar para novo cartão
        if (data.code === 'INVALID_CARD_TOKEN') {
          setUseNewCard(true);
          setSelectedCardToken(null);
          toast.error(data.message || 'Cartão inválido. Por favor, adicione um novo cartão.');
          return;
        }
        throw new Error(data.error || data.message || 'Erro ao atualizar cartão');
      }

      toast.success(data.message || 'Cartão atualizado e dívidas canceladas!');
      
      if (data.invoiceUrl) {
        toast.info('Redirecionando para a página de pagamento...');
        setTimeout(() => {
          window.open(data.invoiceUrl, '_blank');
        }, 1000);
      }

      onOpenChange(false);
      onSuccess?.();
      
    } catch (error: any) {
      console.error('Erro ao atualizar cartão:', error);
      toast.error(error.message || 'Erro ao atualizar cartão');
    } finally {
      setIsLoading(false);
    }
  };

  const isNewCardValid = () => {
    if (!useNewCard) return true;
    
    return cardData.number.length >= 16 &&
           cardData.expiryMonth.length === 2 &&
           cardData.expiryYear.length === 2 &&
           cardData.ccv.length >= 3 &&
           cardData.holderName.length > 0 &&
           cardData.holderCpf.length >= 11;
  };

  const resetForm = () => {
    setSelectedCardToken(null);
    setUseNewCard(false);
    setSaveCard(false);
    setConfirmAction(false);
    setCardData({
      number: '',
      expiryMonth: '',
      expiryYear: '',
      ccv: '',
      holderName: '',
      holderCpf: ''
    });
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) resetForm();
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-600" />
            Trocar Cartão e Cancelar Dívidas Antigas
          </DialogTitle>
          <DialogDescription>
            Esta ação irá cancelar todas as faturas em atraso e configurar um novo cartão com cobrança imediata.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Aviso Importante */}
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <div className="space-y-2">
                <p><strong>⚠️ ATENÇÃO: Esta ação é irreversível!</strong></p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Todas as faturas em atraso serão <strong>canceladas definitivamente</strong></li>
                  <li>Uma nova cobrança será gerada <strong>hoje</strong> com o novo cartão</li>
                  <li>Você será redirecionado para efetuar o pagamento imediatamente</li>
                  <li>A assinatura será reativada após a confirmação do pagamento</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>

          {/* Informações do Cenário */}
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-600" />
                Cenário: Usuário com Dívidas em Atraso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-orange-700">
                • Todas as faturas vencidas serão canceladas<br/>
                • Novo cartão será configurado na assinatura<br/>
                • Nova cobrança será gerada hoje<br/>
                • Assinatura será reativada após pagamento
              </CardDescription>
            </CardContent>
          </Card>

          {/* Seletor de Cartão */}
          <SavedCardSelector
            onCardSelect={handleCardSelect}
            onNewCard={handleNewCard}
            disabled={isLoading}
          />

          {/* Formulário de Novo Cartão */}
          {useNewCard && (
            <Card>
              <CardHeader>
                <CardTitle>Dados do Novo Cartão</CardTitle>
              </CardHeader>
              <CardContent>
                <CreditCardForm
                  data={cardData}
                  onChange={handleCardDataChange}
                  disabled={isLoading}
                />
                
                <div className="flex items-center space-x-2 mt-4">
                  <Switch
                    id="save-card"
                    checked={saveCard}
                    onCheckedChange={setSaveCard}
                    disabled={isLoading}
                  />
                  <Label htmlFor="save-card">
                    Salvar este cartão para futuras compras
                  </Label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Confirmação */}
          <Card className="border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="confirm-action"
                  checked={confirmAction}
                  onChange={(e) => setConfirmAction(e.target.checked)}
                  disabled={isLoading}
                  className="h-4 w-4"
                />
                <Label htmlFor="confirm-action" className="text-sm">
                  <strong>Confirmo que entendo</strong> que esta ação irá cancelar todas as dívidas em atraso de forma definitiva e gerar uma nova cobrança hoje.
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Botões de Ação */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="flex-1"
            >
              Cancelar
            </Button>
            
            <Button
              onClick={handleUpdateCard}
              disabled={isLoading || !confirmAction || (!selectedCardToken && !isNewCardValid())}
              className="flex-1 bg-orange-600 hover:bg-orange-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Confirmar e Prosseguir
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateCardCancelOverdueModal;