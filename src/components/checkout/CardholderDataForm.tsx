import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CEPInput } from '@/components/common/CEPInput';

interface CardholderData {
  name: string;
  cpf: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  phone: string;
}

interface CardholderDataFormProps {
  data: CardholderData;
  onChange: (field: keyof CardholderData, value: string) => void;
  disabled?: boolean;
}

export const CardholderDataForm: React.FC<CardholderDataFormProps> = ({
  data,
  onChange,
  disabled = false
}) => {
  
  const formatPhone = (value: string) => {
    const v = value.replace(/\D/g, '');
    if (v.length <= 11) {
      return v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return v.substring(0, 11).replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanValue = e.target.value.replace(/\D/g, '');
    onChange('phone', cleanValue);
  };

  const handleAddressFound = (address: any) => {
    if (address.logradouro) onChange('street', address.logradouro);
    if (address.bairro) onChange('neighborhood', address.bairro);
    if (address.localidade) onChange('city', address.localidade);
    if (address.uf) onChange('state', address.uf);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados do Portador do Cartão</CardTitle>
        <p className="text-sm text-muted-foreground">
          Estes dados serão usados para validação do cartão e devem corresponder ao titular.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cardholderName">Nome Completo</Label>
            <Input
              id="cardholderName"
              type="text"
              placeholder="Nome como no cartão"
              value={data.name}
              onChange={(e) => onChange('name', e.target.value.toUpperCase())}
              disabled={disabled}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cardholderPhone">Telefone</Label>
            <Input
              id="cardholderPhone"
              type="text"
              placeholder="(11) 99999-9999"
              value={formatPhone(data.phone)}
              onChange={handlePhoneChange}
              disabled={disabled}
              maxLength={15}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <CEPInput
            value={data.cep}
            onChange={(value) => onChange('cep', value)}
            onAddressFound={handleAddressFound}
            label="CEP"
            placeholder="00000-000"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="cardholderStreet">Endereço</Label>
            <Input
              id="cardholderStreet"
              type="text"
              placeholder="Rua, Avenida, etc."
              value={data.street}
              onChange={(e) => onChange('street', e.target.value)}
              disabled={disabled}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cardholderNumber">Número</Label>
            <Input
              id="cardholderNumber"
              type="text"
              placeholder="123"
              value={data.number}
              onChange={(e) => onChange('number', e.target.value)}
              disabled={disabled}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cardholderComplement">Complemento (opcional)</Label>
          <Input
            id="cardholderComplement"
            type="text"
            placeholder="Apt, Bloco, etc."
            value={data.complement}
            onChange={(e) => onChange('complement', e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cardholderNeighborhood">Bairro</Label>
            <Input
              id="cardholderNeighborhood"
              type="text"
              placeholder="Bairro"
              value={data.neighborhood}
              onChange={(e) => onChange('neighborhood', e.target.value)}
              disabled={disabled}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="cardholderCity">Cidade</Label>
              <Input
                id="cardholderCity"
                type="text"
                placeholder="Cidade"
                value={data.city}
                onChange={(e) => onChange('city', e.target.value)}
                disabled={disabled}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardholderState">UF</Label>
              <Input
                id="cardholderState"
                type="text"
                placeholder="SP"
                value={data.state}
                onChange={(e) => onChange('state', e.target.value.toUpperCase())}
                disabled={disabled}
                maxLength={2}
                required
              />
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
          <p className="font-medium mb-1">⚠️ Importante:</p>
          <p>• Os dados devem ser exatamente iguais aos do portador do cartão</p>
          <p>• O CPF deve ser do titular do cartão (preenchido acima)</p>
          <p>• Endereço deve corresponder ao cadastro do banco</p>
        </div>
      </CardContent>
    </Card>
  );
};