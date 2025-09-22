import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CreditCardData {
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
  holderName: string;
}

interface CreditCardFormProps {
  data: CreditCardData;
  onChange: (field: keyof CreditCardData, value: string) => void;
  disabled?: boolean;
}

export const CreditCardForm: React.FC<CreditCardFormProps> = ({
  data,
  onChange,
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
    onChange('number', formatted);
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
    onChange('holderName', e.target.value.toUpperCase());
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

      <div className="space-y-2">
        <Label htmlFor="holderName">Nome no Cartão</Label>
        <Input
          id="holderName"
          type="text"
          placeholder="JOÃO DA SILVA"
          value={data.holderName}
          onChange={handleHolderNameChange}
          disabled={disabled}
        />
      </div>

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