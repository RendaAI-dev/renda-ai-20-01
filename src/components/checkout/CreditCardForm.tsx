import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CreditCardData {
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

interface CardholderData {
  holderName: string;
  holderCpf: string;
}

interface CreditCardFormProps {
  data: CreditCardData;
  onChange: (field: keyof CreditCardData, value: string) => void;
  cardholderData?: CardholderData;
  onCardholderChange?: (field: keyof CardholderData, value: string) => void;
  disabled?: boolean;
}

export const CreditCardForm: React.FC<CreditCardFormProps> = ({
  data,
  onChange,
  cardholderData,
  onCardholderChange,
  disabled = false
}) => {

  
  const formatCardNumber = (value: string) => {
    // Remove all non-digits
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    
    // Add spaces every 4 digits
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiryMonth = (value: string) => {
    const v = value.replace(/\D/g, '');
    if (v.length >= 2) {
      const month = parseInt(v.substring(0, 2));
      return month > 12 ? '12' : v.substring(0, 2);
    }
    return v;
  };

  const formatExpiryYear = (value: string) => {
    const v = value.replace(/\D/g, '');
    return v.substring(0, 2);
  };

  const formatCCV = (value: string) => {
    const v = value.replace(/\D/g, '');
    return v.substring(0, 4);
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };


  const detectCardBrand = (number: string) => {
    const cleanNumber = number.replace(/\s/g, '');
    
    if (/^4/.test(cleanNumber)) return 'visa';
    if (/^5[1-5]/.test(cleanNumber)) return 'mastercard';
    if (/^3[47]/.test(cleanNumber)) return 'amex';
    if (/^6/.test(cleanNumber)) return 'discover';
    
    return '';
  };

  const cardBrand = detectCardBrand(data.number);

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    const cleanNumber = formatted.replace(/\s/g, '');
    
    onChange('number', cleanNumber);

    // Validar cartão de teste em tempo real (apenas no sandbox)
    const isAsaasSandbox = window.location.hostname.includes('localhost') || 
                          window.location.hostname.includes('dev') ||
                          window.location.hostname.includes('staging');

    if (isAsaasSandbox && cleanNumber.length >= 16) {
      validateTestCard(cleanNumber);
    }
  };

  const validateTestCard = async (cardNumber: string) => {
    try {
      const { data: validationResult } = await supabase.functions.invoke('validate-test-cards', {
        body: { cardNumber }
      });

      if (validationResult?.success) {
        const validation = validationResult.validation;
        
        if (validation.isValidTestCard && validation.expectedResult === 'approved') {
          // Cartão será aprovado automaticamente
          console.log('✅ Cartão de teste válido - será aprovado automaticamente');
        } else if (validation.isTestCard && validation.expectedResult === 'pending') {
          console.warn('⚠️ Cartão pode ficar pendente - considere usar um cartão aprovado automaticamente');
        }
      }
    } catch (error) {
      console.error('Erro ao validar cartão de teste:', error);
    }
  };

  const handleExpiryMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiryMonth(e.target.value);
    onChange('expiryMonth', formatted);
  };

  const handleExpiryYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiryYear(e.target.value);
    onChange('expiryYear', formatted);
  };

  const handleCCVChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCCV(e.target.value);
    onChange('ccv', formatted);
  };

  const handleHolderNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onCardholderChange?.('holderName', e.target.value);
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    onCardholderChange?.('holderCpf', formatted);
  };


  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cardNumber">Número do Cartão</Label>
        <div className="relative">
          <Input
            id="cardNumber"
            type="text"
            placeholder="1234 5678 9012 3456"
            value={data.number}
            onChange={handleCardNumberChange}
            disabled={disabled}
            maxLength={19}
            className="pr-12"
          />
          {cardBrand && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="w-8 h-5 bg-muted rounded flex items-center justify-center text-xs font-bold">
                {cardBrand === 'visa' && '💳'}
                {cardBrand === 'mastercard' && '💳'}
                {cardBrand === 'amex' && '💳'}
                {cardBrand === 'discover' && '💳'}
              </div>
            </div>
          )}
        </div>
      </div>

      {cardholderData && onCardholderChange && (
        <>
          <div className="space-y-2">
            <Label htmlFor="holderName">Nome completo do titular *</Label>
            <Input
              id="holderName"
              type="text"
              placeholder="Nome como está no cartão"
              value={cardholderData.holderName}
              onChange={handleHolderNameChange}
              disabled={disabled}
            />
            <p className="text-xs text-muted-foreground">
              Digite o nome exatamente como está no cartão
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="holderCpf">CPF do titular *</Label>
            <Input
              id="holderCpf"
              type="text"
              placeholder="000.000.000-00"
              value={cardholderData.holderCpf}
              onChange={handleCpfChange}
              disabled={disabled}
              maxLength={14}
            />
            <p className="text-xs text-muted-foreground">
              CPF da pessoa que é titular do cartão
            </p>
          </div>
        </>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="expiryMonth">Mês</Label>
          <Input
            id="expiryMonth"
            type="text"
            placeholder="12"
            value={data.expiryMonth}
            onChange={handleExpiryMonthChange}
            disabled={disabled}
            maxLength={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="expiryYear">Ano</Label>
          <Input
            id="expiryYear"
            type="text"
            placeholder="28"
            value={data.expiryYear}
            onChange={handleExpiryYearChange}
            disabled={disabled}
            maxLength={2}
          />
        </div>

        <div className="col-span-2 space-y-2">
          <Label htmlFor="ccv">CCV</Label>
          <Input
            id="ccv"
            type="text"
            placeholder="123"
            value={data.ccv}
            onChange={handleCCVChange}
            disabled={disabled}
            maxLength={4}
          />
        </div>
      </div>

      <div className="text-xs text-muted-foreground mt-4">
        <p className="flex items-center gap-2">
          🔒 Seus dados são criptografados e processados com segurança
        </p>
      </div>
    </div>
  );
};