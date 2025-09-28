import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface CPFInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

export function CPFInput({ 
  value, 
  onChange, 
  error, 
  label = "CPF", 
  placeholder = "000.000.000-00",
  required = false 
}: CPFInputProps) {
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');
  const formatCPF = (cpf: string): string => {
    const cleanCPF = cpf.replace(/\D/g, '');
    return cleanCPF
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const validateCPF = (cpf: string): boolean => {
    const cleanCPF = cpf.replace(/\D/g, '');
    
    if (cleanCPF.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(10))) return false;

    return true;
  };

  const checkDuplicate = async (cpf: string) => {
    if (!cpf || cpf.length < 14) return; // Minimum formatted length

    setIsChecking(true);
    setDuplicateError('');
    
    try {
      const cleanCPF = cpf.replace(/\D/g, '');
      
      const { data, error } = await supabase.functions.invoke('check-duplicate-data', {
        body: { cpf: cleanCPF }
      });

      if (error) {
        console.error('Error checking duplicate:', error);
        return;
      }

      if (data?.duplicates?.cpf) {
        setIsDuplicate(true);
        setDuplicateError('Este CPF já está cadastrado');
      } else {
        setIsDuplicate(false);
        setDuplicateError('');
      }
    } catch (error) {
      console.error('Error checking CPF duplicate:', error);
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
    const formattedValue = formatCPF(e.target.value);
    onChange(formattedValue);
  };

  const isValid = value.length === 0 || validateCPF(value);
  const inputClassName = !isValid && value.length > 0 
    ? 'border-destructive' 
    : isDuplicate 
    ? 'border-destructive focus:ring-destructive' 
    : duplicateError === '' && value.length >= 14 && !isChecking 
    ? 'border-green-500 focus:ring-green-500' 
    : '';

  return (
    <div className="space-y-2">
      <Label htmlFor="cpf">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="relative">
        <Input
          id="cpf"
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          maxLength={14}
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
      {!isValid && value.length > 0 && !duplicateError && (
        <p className="text-sm text-destructive">CPF inválido</p>
      )}
    </div>
  );
}