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
  creditCardHolderName?: string;
  creditCardHolderCpf?: string;
}

export const CardholderDataForm: React.FC<CardholderDataFormProps> = ({
  data,
  onChange,
  disabled = false,
  creditCardHolderName = '',
  creditCardHolderCpf = ''
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
          Nome e CPF são preenchidos automaticamente do cartão. Outros dados vêm do seu cadastro.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
          <p className="text-sm text-blue-800">
            ℹ️ <strong>Dados preenchidos automaticamente:</strong> Telefone e endereço foram preenchidos do seu cadastro. Nome e CPF vêm dos dados do cartão de crédito.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cardholderName">Nome Completo</Label>
            <Input
              id="cardholderName"
              type="text"
              value={creditCardHolderName}
              disabled={true}
              className="bg-muted"
              placeholder="Nome será preenchido do cartão"
            />
            <p className="text-xs text-muted-foreground">Preenchido automaticamente do cartão de crédito</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cardholderPhone">Telefone</Label>
            <Input
              id="cardholderPhone"
              type="text"
              value={formatPhone(data.phone)}
              disabled={true}
              className="bg-muted"
              placeholder="Telefone do seu cadastro"
            />
            <p className="text-xs text-muted-foreground">Preenchido do seu cadastro</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cardholderCpf">CPF do Portador</Label>
          <Input
            id="cardholderCpf"
            type="text"
            value={creditCardHolderCpf}
            disabled={true}
            className="bg-muted"
            placeholder="CPF será preenchido do cartão"
          />
          <p className="text-xs text-muted-foreground">Preenchido automaticamente do cartão de crédito</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cardholderCep">CEP</Label>
          <Input
            id="cardholderCep"
            type="text"
            value={data.cep}
            disabled={true}
            className="bg-muted"
            placeholder="CEP do seu cadastro"
          />
          <p className="text-xs text-muted-foreground">Preenchido do seu cadastro</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="cardholderStreet">Endereço</Label>
            <Input
              id="cardholderStreet"
              type="text"
              value={data.street}
              disabled={true}
              className="bg-muted"
              placeholder="Endereço do seu cadastro"
            />
            <p className="text-xs text-muted-foreground">Preenchido do seu cadastro</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cardholderNumber">Número</Label>
            <Input
              id="cardholderNumber"
              type="text"
              value={data.number}
              disabled={true}
              className="bg-muted"
              placeholder="Número do seu cadastro"
            />
            <p className="text-xs text-muted-foreground">Preenchido do seu cadastro</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cardholderComplement">Complemento</Label>
          <Input
            id="cardholderComplement"
            type="text"
            value={data.complement}
            disabled={true}
            className="bg-muted"
            placeholder="Complemento do seu cadastro"
          />
          <p className="text-xs text-muted-foreground">Preenchido do seu cadastro</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cardholderNeighborhood">Bairro</Label>
            <Input
              id="cardholderNeighborhood"
              type="text"
              value={data.neighborhood}
              disabled={true}
              className="bg-muted"
              placeholder="Bairro do seu cadastro"
            />
            <p className="text-xs text-muted-foreground">Preenchido do seu cadastro</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="cardholderCity">Cidade</Label>
              <Input
                id="cardholderCity"
                type="text"
                value={data.city}
                disabled={true}
                className="bg-muted"
                placeholder="Cidade do seu cadastro"
              />
              <p className="text-xs text-muted-foreground">Preenchido do seu cadastro</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardholderState">UF</Label>
              <Input
                id="cardholderState"
                type="text"
                value={data.state}
                disabled={true}
                className="bg-muted"
                placeholder="UF do seu cadastro"
              />
              <p className="text-xs text-muted-foreground">Preenchido do seu cadastro</p>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="font-medium mb-1 text-green-800">✅ Dados Automáticos:</p>
          <p className="text-green-700">• Nome e CPF: Preenchidos automaticamente do cartão de crédito</p>
          <p className="text-green-700">• Telefone e Endereço: Preenchidos do seu cadastro de usuário</p>
          <p className="text-green-700">• Não é necessário preencher manualmente estes campos</p>
        </div>
      </CardContent>
    </Card>
  );
};