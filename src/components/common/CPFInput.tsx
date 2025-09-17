import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedValue = formatCPF(e.target.value);
    onChange(formattedValue);
  };

  const isValid = value.length === 0 || validateCPF(value);

  return (
    <div className="space-y-2">
      <Label htmlFor="cpf">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        id="cpf"
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={14}
        className={!isValid ? 'border-destructive' : ''}
        required={required}
      />
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {!isValid && value.length > 0 && (
        <p className="text-sm text-destructive">CPF inválido</p>
      )}
    </div>
  );
}