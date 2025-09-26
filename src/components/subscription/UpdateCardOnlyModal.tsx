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
import { CreditCard, Loader2, CheckCircle } from 'lucide-react';
import { SavedCardSelector } from '@/components/checkout/SavedCardSelector';
import { CreditCardForm } from '@/components/checkout/CreditCardForm';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UpdateCardOnlyModalProps {
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

const UpdateCardOnlyModal: React.FC<UpdateCardOnlyModalProps> = ({
  open,
  onOpenChange,
  onSuccess
}) => {
  const [selectedCardToken, setSelectedCardToken] = useState<string | null>(null);
  const [useNewCard, setUseNewCard] = useState(false);
  const [saveCard, setSaveCard] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
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
    if (!selectedCardToken && !isNewCardValid()) {
      toast.error('Por favor, selecione um cartão ou preencha os dados do novo cartão');
      return;
    }

    setIsLoading(true);

    try {
      const requestBody = {
        scenario: 'update_card_only' as const,
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

      toast.success(data.message || 'Cartão atualizado com sucesso!');
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
            <CreditCard className="w-5 h-5" />
            Atualizar Cartão de Crédito
          </DialogTitle>
          <DialogDescription>
            Atualize seu cartão de crédito para futuras cobranças. O novo cartão será usado a partir da próxima cobrança.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações do Cenário */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                Cenário: Usuário em Dia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-blue-700">
                • Seu cartão atual será substituído pelo novo<br/>
                • Não haverá cobrança imediata<br/>
                • O novo cartão será usado nas próximas cobranças<br/>
                • Pagamentos pendentes não serão afetados
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
              disabled={isLoading || (!selectedCardToken && !isNewCardValid())}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Atualizar Cartão
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateCardOnlyModal;