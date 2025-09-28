import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface EmailInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

export function EmailInput({ 
  value, 
  onChange, 
  error, 
  label = "Email", 
  placeholder = "seu@email.com",
  required = false 
}: EmailInputProps) {
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');
  const [formatError, setFormatError] = useState('');

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const checkDuplicate = async (email: string) => {
    if (!email || !validateEmail(email)) return;

    setIsChecking(true);
    setDuplicateError('');
    
    try {
      const { data, error } = await supabase.functions.invoke('check-duplicate-data', {
        body: { email: email.trim() }
      });

      if (error) {
        console.error('Error checking duplicate:', error);
        return;
      }

      if (data?.duplicates?.email) {
        setIsDuplicate(true);
        setDuplicateError('Este email já está cadastrado');
      } else {
        setIsDuplicate(false);
        setDuplicateError('');
      }
    } catch (error) {
      console.error('Error checking email duplicate:', error);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (value && value.trim()) {
        if (!validateEmail(value)) {
          setFormatError('Formato de email inválido');
          setIsDuplicate(false);
          setDuplicateError('');
        } else {
          setFormatError('');
          checkDuplicate(value);
        }
      } else {
        setIsDuplicate(false);
        setDuplicateError('');
        setFormatError('');
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const isValid = value.length === 0 || validateEmail(value);
  const inputClassName = !isValid || formatError
    ? 'border-destructive' 
    : isDuplicate 
    ? 'border-destructive focus:ring-destructive' 
    : duplicateError === '' && value.length > 0 && !isChecking && isValid
    ? 'border-green-500 focus:ring-green-500' 
    : '';

  return (
    <div className="space-y-2">
      <Label htmlFor="email">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="relative">
        <Input
          id="email"
          type="email"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
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
      {formatError && (
        <p className="text-sm text-destructive">{formatError}</p>
      )}
      {duplicateError && (
        <p className="text-sm text-destructive">{duplicateError}</p>
      )}
    </div>
  );
}