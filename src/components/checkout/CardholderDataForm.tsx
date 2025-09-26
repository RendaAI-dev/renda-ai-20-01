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
  return;
};