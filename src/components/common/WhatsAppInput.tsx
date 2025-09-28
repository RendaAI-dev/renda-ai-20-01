import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface WhatsAppInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

export function WhatsAppInput({ 
  value, 
  onChange, 
  error, 
  label = "WhatsApp", 
  placeholder = "(11) 99999-9999",
  required = false 
}: WhatsAppInputProps) {
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');

  const formatWhatsApp = (phone: string): string => {
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  const checkDuplicate = async (phone: string) => {
    if (!phone || phone.length < 14) return; // Minimum formatted length

    setIsChecking(true);
    setDuplicateError('');
    
    try {
      const { data, error } = await supabase.functions.invoke('check-duplicate-data', {
        body: { phone: phone.replace(/\D/g, '') }
      });

      if (error) {
        console.error('Error checking duplicate:', error);
        return;
      }

      if (data?.duplicates?.phone) {
        setIsDuplicate(true);
        setDuplicateError('Este WhatsApp já está cadastrado');
      } else {
        setIsDuplicate(false);
        setDuplicateError('');
      }
    } catch (error) {
      console.error('Error checking WhatsApp duplicate:', error);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (value && value.length >= 14) {
        checkDuplicate(value);
      } else {
        setIsDuplicate(false);
        setDuplicateError('');
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedValue = formatWhatsApp(e.target.value);
    onChange(formattedValue);
  };

  const inputClassName = isDuplicate 
    ? 'border-destructive focus:ring-destructive' 
    : duplicateError === '' && value.length >= 14 && !isChecking 
    ? 'border-green-500 focus:ring-green-500' 
    : '';

  return (
    <div className="space-y-2">
      <Label htmlFor="whatsapp">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="relative">
        <Input
          id="whatsapp"
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          maxLength={15}
          className={inputClassName}
          required={required}
        />
        {isChecking && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {duplicateError && (
        <p className="text-sm text-destructive">{duplicateError}</p>
      )}
    </div>
  );
}