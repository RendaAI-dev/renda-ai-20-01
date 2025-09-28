import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CardholderData {
  holderName: string;
  holderCpf: string;
}

interface CardholderDataFormProps {
  data: CardholderData;
  onChange: (field: keyof CardholderData, value: string) => void;
  disabled?: boolean;
  userData?: any;
}

export function CardholderDataForm({ data, onChange, disabled, userData }: CardholderDataFormProps) {
  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const handleCpfChange = (value: string) => {
    const formatted = formatCPF(value);
    onChange('holderCpf', formatted);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados do Titular do Cartão</CardTitle>
        <p className="text-sm text-muted-foreground">
          Informe os dados do titular do cartão de crédito
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="holderName">Nome completo do titular *</Label>
          <Input
            id="holderName"
            placeholder="Nome como está no cartão"
            value={data.holderName}
            onChange={(e) => onChange('holderName', e.target.value)}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Digite o nome exatamente como está no cartão
          </p>
        </div>

        <div>
          <Label htmlFor="holderCpf">CPF do titular *</Label>
          <Input
            id="holderCpf"
            placeholder="000.000.000-00"
            value={data.holderCpf}
            onChange={(e) => handleCpfChange(e.target.value)}
            disabled={disabled}
            maxLength={14}
          />
          <p className="text-xs text-muted-foreground mt-1">
            CPF da pessoa que é titular do cartão
          </p>
        </div>

        {userData && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <h4 className="text-sm font-medium mb-2">Dados de cobrança (do seu perfil):</h4>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Nome:</strong> {userData.name}</p>
              <p><strong>Telefone:</strong> {userData.phone}</p>
              <p><strong>Endereço:</strong> {userData.street}, {userData.number}</p>
              <p><strong>Cidade:</strong> {userData.city}/{userData.state}</p>
              <p><strong>CEP:</strong> {userData.cep}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}