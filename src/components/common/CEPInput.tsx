import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';
import { viacepService, type Address } from '@/services/viacepService';
import { toast } from '@/hooks/use-toast';

interface CEPInputProps {
  value: string;
  onChange: (value: string) => void;
  onAddressFound?: (address: Address) => void;
  error?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

export function CEPInput({ 
  value, 
  onChange, 
  onAddressFound,
  error, 
  label = "CEP", 
  placeholder = "00000-000",
  required = false 
}: CEPInputProps) {
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSearchedCEP = useRef<string>('');

  // Auto search when valid CEP is entered
  useEffect(() => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Only search if CEP is valid and different from last searched
    if (viacepService.isValidCEP(value) && value !== lastSearchedCEP.current) {
      timeoutRef.current = setTimeout(() => {
        handleSearchCEP();
      }, 500); // 500ms debounce
    }

    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value]);

  const formatCEP = (cep: string): string => {
    const cleanCEP = cep.replace(/\D/g, '');
    return cleanCEP.replace(/(\d{5})(\d{3})/, '$1-$2');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedValue = formatCEP(e.target.value);
    onChange(formattedValue);
  };

  const handleSearchCEP = async () => {
    if (!viacepService.isValidCEP(value)) {
      toast({
        variant: "destructive",
        title: "CEP inválido",
        description: "Por favor, digite um CEP válido com 8 dígitos."
      });
      return;
    }

    // Update last searched CEP to avoid duplicate searches
    lastSearchedCEP.current = value;

    setIsLoading(true);
    try {
      const address = await viacepService.getAddressByCEP(value);
      if (address && onAddressFound) {
        onAddressFound(address);
        toast({
          title: "Endereço encontrado!",
          description: `${address.street}, ${address.neighborhood} - ${address.city}/${address.state}`
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao buscar CEP",
        description: error instanceof Error ? error.message : "Erro desconhecido"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchCEP();
    }
  };

  const isValid = value.length === 0 || viacepService.isValidCEP(value);

  return (
    <div className="space-y-2">
      <Label htmlFor="cep">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="flex gap-2">
        <Input
          id="cep"
          type="text"
          value={value}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          maxLength={9}
          className={!isValid ? 'border-destructive' : ''}
          required={required}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleSearchCEP}
          disabled={!isValid || value.length === 0 || isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {!isValid && value.length > 0 && (
        <p className="text-sm text-destructive">CEP deve ter 8 dígitos</p>
      )}
    </div>
  );
}