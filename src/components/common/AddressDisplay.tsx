import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Address } from '@/services/viacepService';

interface AddressDisplayProps {
  address: Address | null;
  onAddressChange?: (field: keyof Address, value: string) => void;
  editable?: boolean;
}

export function AddressDisplay({ address, onAddressChange, editable = true }: AddressDisplayProps) {
  const currentAddress = address || {
    cep: '',
    street: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    ibge: '',
    ddd: ''
  };

  const handleFieldChange = (field: keyof Address, value: string) => {
    if (onAddressChange) {
      onAddressChange(field, value);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="street">Logradouro</Label>
          <Input
            id="street"
            value={currentAddress.street}
            onChange={(e) => handleFieldChange('street', e.target.value)}
            disabled={!editable}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="complement">Complemento</Label>
          <Input
            id="complement"
            value={currentAddress.complement}
            onChange={(e) => handleFieldChange('complement', e.target.value)}
            placeholder="Apto, casa, etc."
            disabled={!editable}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="neighborhood">Bairro</Label>
          <Input
            id="neighborhood"
            value={currentAddress.neighborhood}
            onChange={(e) => handleFieldChange('neighborhood', e.target.value)}
            disabled={!editable}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="city">Cidade</Label>
          <Input
            id="city"
            value={currentAddress.city}
            onChange={(e) => handleFieldChange('city', e.target.value)}
            disabled={!editable}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="state">Estado</Label>
          <Input
            id="state"
            value={currentAddress.state}
            onChange={(e) => handleFieldChange('state', e.target.value)}
            maxLength={2}
            disabled={!editable}
          />
        </div>
      </div>
    </div>
  );
}